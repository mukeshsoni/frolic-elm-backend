// @flow

import R from 'ramda'
import Task from 'fun-task'
import packageJsonTemplateFileContents from './temp/elm-package-template.js'
import path from 'path'
const exec = require('child_process').exec
const fs = require('fs')

import { tokenize } from './parser.js'
import {
  createTokenHash,
  cleanUpExpression,
} from './helpers'
const basePath = path.resolve(__dirname)

const tempFolderPath = `${basePath}/temp`
const codePath = tempFolderPath
const promisify = require('promisify-node')
const promisifiedExec = promisify(exec)

import {
  writeSourcesToElmPackageJson,
  updateFileSources,
  writeCodeToFile,
  getGeneratedMainFileContent,
  getGeneratedFrolicFileContent,
  writeFilesForExpressions,
} from './fileWriters.js'

const numLinesAddedToPlaygroundFile = 5

let lastOpenFilePath = ''

function inCache(token) : boolean {
  return Boolean(cachedSources[token.hash])
}

const notInCache = R.negate(inCache)

function handleCancel() {
  ps.lookup({
    command: 'elm-make',
    psargs: 'ax'
  }, (err, resultList) => {
    if (err) {
      console.log('error getting command info', err.toString()) // eslint-disable-line no-console
    } else {
      resultList.forEach((process) => {
        ps.kill(process.pid, (errorGettingProcessInfo) => {
          if (errorGettingProcessInfo) {
            console.error('Error killing process ', errorGettingProcessInfo.toString()) // eslint-disable-line no-console
          }
        })
      })
    }
  })
}


function compileElmFile(expression) {
  return Task.create((onSuccess, onFailure) => {
    const fileName = `F${expression.hash}`
    promisifiedExec(`cd ${codePath} && elm-make --yes ${fileName}.elm --output=${fileName}.js`)
       .then(() => onSuccess())
      .catch(e => onFailure(e))
    return handleCancel
  })
}

function compileElmFiles(expressions) {
  return Task.parallel(expressions.map(compileElmFile))
}

var runningTask

export function compile(code: string = '', playgroundCode: string = '', openFilePath: string) {
  if(runningTask && runningTask.cancel) {
      runningTask.cancel()
  }

  // get folder path from file path
  const openFileFolderPath
    = openFilePath
    ? R.init(openFilePath.split('/')).join('/')
    : null

  const tokens = tokenize(playgroundCode.trim())
  const tokensWithHashes = tokens.map((token) => ({
    ...token,
    hash: createTokenHash(openFilePath || '', token, code.trim())
  }))

  return updateFileSources(openFileFolderPath, lastOpenFilePath, packageJsonTemplateFileContents)
    .then(() => writeCodeToFile(code))
    .then((userModuleName) => writeFilesForExpressions(tokensWithHashes, userModuleName, codePath, notInCache))
    .then((expressions) => ({allPromises: compileElmFiles(expressions), expressions}))
    .then(({allPromises, expressions}) => { // eslint-disable-line
      return new Promise((resolve, reject, onCancel) => {
        // on cancellation of promise
        if(onCancel) {
          onCancel(handleCancel)
        }

        return Promise.all(allPromises.map(reflect))
          .then(resultToComponent.bind(null, expressions))
          .then(resolve)
          .catch(reject)
      })
    })
    .catch((err) => {
      console.log('elm compilation error', err.toString()) // eslint-disable-line no-console
      subscriber.next({
        error: getFormattedError(err)
      })
    })
}

function onNewFileLoad(openFilePath: string) {
  const openFileFolderPath = openFilePath
    ? R.init(openFilePath.split('/')).join('/')
    : null
  updateFileSources(openFileFolderPath, lastOpenFilePath, packageJsonTemplateFileContents)
}

function cleanUp() {
  if (subscriber) {
    subscriber.complete()
  }
}

// // TODO - to be done
function generateTests() {
  return '-- to be implemented'
}

function formatCode(code: string) {
  const cmd = `${basePath}/elm-format --stdin`

  function execFormat(callback) {
    const child = exec(cmd, callback)
    child.stdin.write(code)
    child.stdin.end()
    return child
  }

  return Promise.promisify(execFormat)()
  // .then((formattedCode) => R.drop(formattedCode.split('\n'), 2).join('\n'))
}

function onCodeChange(code: string, playgroundCode: string, openFilePath: string) {
  return this.compile(code, playgroundCode, openFilePath)
}

function onPlaygroundCodeChange(code: string, playgroundCode: string, openFilePath: string) {
  return this.compile(code, playgroundCode, openFilePath)
}

// do some initialization work here
export function compiler() {
  return {
    compile,
    cleanUp,
    onNewFileLoad,
    generateTests,
    formatCode,
    outputStream: getObservable(),
    onCodeChange,
    onPlaygroundCodeChange,
    editorMode: 'elm',
    extensions: ['elm'],
    sampleCode: 'add x y = x + y',
    samplePlaygroundCode: 'add 1 2'
  }
}

let cachedNonEvaledFiles = {}
let cachedSources = {} // eslint-disable-line vars-on-top, prefer-const
const vm = require('vm')

function getSource(module, expression, index): React$Element<any> {
  // if(!cachedSources[getExpressionValue(expression)]) {
  const fileName = `F${expression.hash}`

  if(!cachedSources[expression.hash]) {
    cachedSources[expression.hash] = fs.readFileSync(`${codePath}/${fileName}.js`).toString()
  } else {
    console.log('serving source from cache for expression', expression.value)
  }

  let previousEval
  try {
    // const bundle = fs.readFileSync(bundleFilePath).toString()
    previousEval = global.eval // eslint-disable-line no-eval
    global.eval = (source) => vm.runInThisContext(source) // eslint-disable-line no-eval
    // }
    eval(cachedSources[expression.hash]) // eslint-disable-line no-eval
  } catch (e) {
    console.error('error evaluating bundle', e.toString()) // eslint-disable-line no-console
    // return subscriber.next(getFormattedError(e))
    return getFormattedError(e)
    // throw e
  } finally {
    global.eval = previousEval // eslint-disable-line no-eval
  }

  return global.module.exports[R.capitalize(fileName)]
}
