import Task from 'fun-task'
import chai from 'chai'
const expect = chai.expect

import {
  writeSourcesToElmPackageJson,
  updateFileSources,
  writeCodeToFile,
  getGeneratedMainFileContent,
  getGeneratedFrolicFileContent,
  writeFilesForExpressions,
} from '../fileWriters.js'

describe('file writer helper functions', () => {
  it('should load', () => {
    expect(true).to.be.true
  })

  describe('update file sources', () => {
    it('should return a task', () => {
      expect(updateFileSources(__dirname, __dirname, '')).to.be.an.instanceof(Task)
    })
  })

})
