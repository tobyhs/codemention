import deepEqual from 'fast-deep-equal'
import {Matcher} from 'jest-mock-extended'

// See https://github.com/marchaos/jest-mock-extended/issues/118
export const deepEqualsMatch = <T>(expected: T): Matcher<T> =>
  new Matcher<T>(actual => {
    return deepEqual(expected, actual)
  }, 'deepEqualsMatch()')
