import Task from 'fun-task'
import chai from 'chai'
import path from 'path'
const expect = chai.expect

import {
  writeSourcesToElmPackageJson,
  updateFileSources,
  writeCodeToFile,
  getGeneratedMainFileContent,
  getGeneratedFrolicFileContent,
  writeFilesForExpressions,
  readSources
} from '../fileWriters.js'

describe('file writer helper functions', () => {
  it('should load', () => {
    expect(true).to.be.true
  })

  describe('update file sources', () => {
    it('should return a task', () => {
      // expect(updateFileSources(__dirname, __dirname, '')).to.be.an.instanceof(Task)
    })
  })

  it('should read source-directories property from specified elm json file', () => {
    const sourceFilesInFolderA = [
      path.resolve(`${__dirname}/fixtures/a/.`),
      path.resolve(`${__dirname}/fixtures/a/b`),
    ]

    const pathToJsonFile = path.resolve(__dirname + '/fixtures/a')
    expect(readSources(pathToJsonFile)).to.eql(sourceFilesInFolderA)
  })

  it.only('should read source-directories property from specified elm json file 2', () => {
    const sourceFilesInArchitectureFolder = [
      path.resolve(`${__dirname}/fixtures/elm-architecture-tutorial/nesting`)
    ]

    const pathToJsonFile = path.resolve(__dirname + '/fixtures/elm-architecture-tutorial')
    console.log(readSources(pathToJsonFile))
    expect(readSources(pathToJsonFile)).to.eql(sourceFilesInArchitectureFolder)
  })
})
