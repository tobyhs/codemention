import deepEqual from 'deep-equal'
import {Matcher} from 'jest-mock-extended'

// See https://github.com/marchaos/jest-mock-extended/issues/118
export const deepEqualsMatch = <T extends any = any>(expected: T) =>
  new Matcher<T>(actual => {
    return deepEqual(expected, actual, {strict: true})
  }, 'deepEqualsMatch()')
