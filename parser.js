// @flow

import R from 'ramda'
import { cleanUpExpression } from './helpers'

export type Token = {
  type: string, // TODO - make it an enum
  newlines: number,
  lineNumber: number,
  value: string,
  commands: Token[],
  hash: string
}

function isAssignment(command) {
  return command.split(' ').indexOf('=') >= 0
}

function isTypeDeclaration(command) {
  return command.split(' ').indexOf(':') === 1
}

function isImportStatement(command) {
  return command.startsWith('import ')
}

function isFrolicExpression(code) {
  return code.startsWith('$')
}

function isRenderExpression (code) : boolean {
  return code.startsWith('render ')
    || code.startsWith('Html.beginnerProgram')
    || code.startsWith('beginnerProgram')
    || code.startsWith('Html.program')
    || code.startsWith('App.program')
    || code.startsWith('program')
}

type ExpressionType
    = 'frolicExpression'
    | 'importStatement'
    | 'renderExpression'
    | 'assignment'
    | 'expression'

function getType(code) : ExpressionType {
  if (isFrolicExpression(code)) {
    return 'frolicExpression'
  } else if (isImportStatement(code)) {
    return 'importStatement'
  } else if (isRenderExpression(code)) {
    return 'renderExpression'
  } else if (isAssignment(code)) {
    return 'assignment'
  } else if (isTypeDeclaration(code)) {
    return 'assignment'
  } else {
    return 'expression'
  }
}

const commandType = R.memoize((command) => ({
  ...command,
  type: getType(command.value)
}))

export function tokenize(code: string) : Array<Token> {
  if(R.trim(code) === '') {
      return []
  }

  return code.split('\n')
  .reduce((acc, line, index) => {
    if (cleanUpExpression(line)[0] === ' ' && index !== 0) {
      return acc.slice(0, acc.length - 1).concat({
        ...acc[acc.length - 1],
        newlines: acc[acc.length - 1].newlines + 1,
        value: `${acc[acc.length - 1].value} ${R.trim(cleanUpExpression(line))}`
      })
    }

    return acc.concat({ newlines: 1, lineNumber: index, value: cleanUpExpression(line) })
  }, [])
  .map(commandType)
  .reduce((acc, command, index) => { // bunch up expressions
    if (index !== 0 && command.type === 'expression' && R.last(acc).type === 'expression') {
      return [
        ...R.init(acc), {
          ...R.last(acc),
          commands: R.last(acc).commands.concat(command)
        }
      ]
    }

    return acc.concat({
      ...command,
      commands: [command]
    })
  }, [])
}
