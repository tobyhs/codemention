import {GitHub} from '@actions/github/lib/utils'
import {beforeEach, describe, expect, it} from '@jest/globals'
import {
  MapFunction,
  PaginationResults,
} from '@octokit/plugin-paginate-rest/dist-types/types'
import {OctokitResponse, RequestInterface} from '@octokit/types'
import deepEqual from 'fast-deep-equal'
import {
  CalledWithMock,
  DeepMockProxy,
  Matcher,
  mockDeep,
} from 'jest-mock-extended'

import {FilesChangedReaderImpl} from '../src/files-changed-reader'
import {Repo} from '../src/github-types'
import {deepEqualsMatch} from './matchers'

describe('FilesChangedReaderImpl', () => {
  let octokit: DeepMockProxy<InstanceType<typeof GitHub>>
  let reader: FilesChangedReaderImpl

  beforeEach(() => {
    octokit = mockDeep<InstanceType<typeof GitHub>>()
    reader = new FilesChangedReaderImpl(octokit)
  })

  describe('.read', () => {
    const repo: Repo = {owner: 'rails', repo: 'rails'}
    const prNumber = 52197

    it('returns the files changed', async () => {
      const expectedFilesChanged = [
        'actionpack/CHANGELOG.md',
        'actionpack/lib/action_controller/metal/conditional_get.rb',
        'actionpack/lib/action_dispatch/http/cache.rb',
        'actionpack/test/controller/render_test.rb',
      ]
      const response = {
        data: [{filename: 'abc.txt'}, {filename: 'def.txt'}],
      } as OctokitResponse<PaginationResults>
      const mapFnMatcher = new Matcher<MapFunction>(
        actual =>
          deepEqual(
            actual(response, () => {}),
            ['abc.txt', 'def.txt'],
          ),
        'mapFnMatcher',
      )
      // Function overloading is broken in jest-mock-extended 4.0.0:
      // https://github.com/marchaos/jest-mock-extended/issues/140
      type PaginateType = <R extends RequestInterface, M extends unknown[]>(
        request: R,
        parameters: Parameters<R>[0],
        mapFn: MapFunction,
      ) => Promise<M>
      const paginateFn = octokit.paginate as CalledWithMock<PaginateType>
      paginateFn
        .calledWith(
          octokit.rest.pulls.listFiles,
          deepEqualsMatch({...repo, pull_number: prNumber, per_page: 100}),
          mapFnMatcher,
        )
        .mockResolvedValue(expectedFilesChanged)

      const actualFilesChanged = await reader.read(repo, prNumber)
      expect(actualFilesChanged).toEqual(expectedFilesChanged)
    })
  })
})
