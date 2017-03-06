// @flow

import R from 'ramda'
import fs from 'fs'
import jsonfile from 'jsonfile'
import path from 'path'
import Task from 'fun-task'
import rtrim from 'rtrim'

import {
  cleanUpExpression,
} from './helpers'

import promisify from 'promisify-node'
const writeJsonFile = promisify(jsonfile.writeFile)

const writeFile = promisify(fs.writeFile)
const basePath = path.resolve(__dirname)

const tempFolderPath = `${basePath}/temp`
const codePath = tempFolderPath
import type { Token } from './parser.js'

type ElmPackageJson = {
  "version": string,
  "summary": string,
  "repository": string,
  "license": string,
  "source-directories": string[],
  "exposed-modules": string[],
  "dependencies": string[],
  "elm-version": string
};

// TODO - should probably return a Maybe
export function readSources(path) {
  const pathToFile = `${path}/elm-package.json`
  try {
    const packageJsonContent = jsonfile.readFileSync(pathToFile)
    if(!packageJsonContent['source-directories']) {
      return []
    }
    return packageJsonContent['source-directories'].map( sourceDirectory => 
      rtrim(`${path}/${sourceDirectory}`, '/.'))
  } catch(e) {
    console.log('error reading package json', e)
    return []
  }
}

function packageJsonExists(path) {
  const filesInFolderToCheck = fs.readdirSync(path)
  return R.contains('elm-package.json', filesInFolderToCheck)
}

function findProbableSources(basePath, depth = 0) : Array<Sources> {
    const maxDepth = 20
    if(depth >= maxDepth) {
      return []
    }

    if(packageJsonExists(basePath)) {
      return readSources(basePath)
    } else if(basePath === '/') {
      return []
    } else {
      return findProbableSources(oneUp(basePath), depth + 1)
    }
}

const trimEnd = ( str ) => str.replace(/\s*$/,"")

export function writeSourcesToElmPackageJson(templateFileContents: ElmPackageJson, basePathForOpenFile: string) {
  const packageJsonFilePath = `${tempFolderPath}/elm-package.json`

  let packageJsonFileContents = {
    ...templateFileContents,
    'source-directories': R.uniq(templateFileContents['source-directories']
        .concat([path.resolve(tempFolderPath), path.resolve(basePathForOpenFile)])
        .concat(findProbableSources(basePathForOpenFile)))
  }

  return writeJsonFile(packageJsonFilePath, packageJsonFileContents, { spaces: 4 })
}

/*
 * Update elm-package.json src property to include path from where the file is loaded
 */
export function updateFileSources(
  openFilePath: ?string = tempFolderPath,
  lastOpenFilePath: string,
  packageJsonTemplateFileContents: ElmPackageJson) {
    if ((openFilePath && lastOpenFilePath === openFilePath)
      || (!openFilePath && lastOpenFilePath === tempFolderPath)) {
      return Task.of(true)
    } else {
      lastOpenFilePath = openFilePath || tempFolderPath
    }

    return writeSourcesToElmPackageJson(packageJsonTemplateFileContents, openFilePath || tempFolderPath)
}

const words = R.split(' ')
export function writeCodeToFile(code: string) {
  const moduleName = 'UserCode'
  let codeToWrite = code.trim()

  // if module declaration is there in the panel, don't add it again
  if (code.startsWith('module ')) {
    const inlineModuleName = words(code)[1]
    codeToWrite = code.replace(`module ${inlineModuleName}`, 'module UserCode')
  } else if (code.trim() === '') { // if code panel is empty, insert a random function
    codeToWrite = `module ${moduleName} exposing (..)

randomIdentityFunction x = x`
  } else {
    codeToWrite = `module ${moduleName} exposing (..)

${code}`
  }

  return writeFile(`${codePath}/${moduleName}.elm`, codeToWrite)
    .then(() => moduleName
          , (err) => console.log('error writing file', `${codePath}/${moduleName}.elm`, err.toString())) // eslint-disable-line no-console
}

export function getGeneratedFrolicFileContent(expression: Token, importStatements: string, statements: string, userModuleName: string) {
  const mainFileTemplateForComponents = `import Html exposing (..)
${importStatements}
import ${userModuleName} exposing (..)`

  let fileContent = ''
  if (expression.value.startsWith('$view')) {
    fileContent = `module F${expression.hash} exposing (..)
${mainFileTemplateForComponents}
${statements}

frolicSpecialUpdate model _ = model
frolicSpecialView _ = ${R.trim(R.drop(1, expression.value.split(' ')).join(' '))}
main =
    beginnerProgram { model = 1 , view = frolicSpecialView , update = frolicSpecialUpdate }
`
  }

  return fileContent
}

export function getGeneratedMainFileContent(expression: Token, importStatements: string, statements: string, userModuleName: string) {
  const mainFileTemplate = `import Html exposing (..)
import ${userModuleName} exposing (..)
${importStatements}
`

  const mainFileTemplateForComponents = `import Html exposing (..)
${importStatements}
import ${userModuleName} exposing (..)`

  let fileContent = ''
  if (expression.type === 'frolicExpression') {
    fileContent = getGeneratedFrolicFileContent(expression, importStatements, statements, userModuleName)
  } else if (expression.type === 'renderExpression') {
    const appProgram = hasSubscribed(expression.value) ? 'program' : 'beginnerProgram'

    fileContent = `module F${expression.hash} exposing (..)
${mainFileTemplateForComponents}
${statements}
main =
    ${appProgram} ${R.drop(1, expression.value.split(' ')).join(' ')}`
  } else {
    fileContent = `module F${expression.hash} exposing (..)
import String
${mainFileTemplate}
${statements}
main =
    pre []
        [ text ${getSimpleExpressionChunk(expression)} ]`
  }

  return fileContent
}

export function writeFilesForExpressions(tokens: Token[], userModuleName: string, codePath: string, notInCache: Function) {
  const importStatements = tokens
                            .filter(notInCache)
                            .filter((token) => token.type === 'importStatement')
                            .map((token) => token.value)
                            .join('\n')
  const statements = tokens
                      .filter(notInCache)
                      .filter((token) => token.type === 'assignment')
                      .map((token) => token.value)
                      .join('\n')
  const allExpressions = tokens.filter((token) => token.type === 'expression' || token.type === 'renderExpression' || token.type === 'frolicExpression')
  const expressions = allExpressions.filter(notInCache)

  const fileWritePromises = expressions.map((expression, index) => writeFile(`${codePath}/F${expression.hash}.elm`, getGeneratedMainFileContent(expression, importStatements, statements, userModuleName, index)))
  return Promise.all(fileWritePromises).then(() => allExpressions)
}

function getToStrings(expression: Token) {
  return expression.commands.map((command) => {
    if (command.value.trim().length === 0) {
      return '"""\n"""'
    } else {
      const newLines = R.times(R.always('\n'), command.newlines).map(() => '"""\n"""').join(',')
      return `Basics.toString (${cleanUpExpression(command.value)}),${newLines}`
    }
  }).join(',')
}

function getSimpleExpressionChunk(expression) {
  return `(String.concat [${getToStrings(expression)}])`
}

function hasSubscribed(code) {
  return code.indexOf('subscriptions') >= 0
}
