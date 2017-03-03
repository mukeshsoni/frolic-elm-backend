const chai = require('chai')
const expect = chai.expect
const { tokenize } = require('../parser')

describe('tokenize', function() {
    it('should ...', function() {
        expect(true).to.be.true
    })

    it('should tokenize empty string', () => {
        const tokens = tokenize('')
        expect(tokens).to.eql([])
    })
})
