import {GitHub} from '@actions/github/lib/utils'
import {beforeEach, describe, expect, it} from '@jest/globals'
import {
  MapFunction,
  PaginationResults
} from '@octokit/plugin-paginate-rest/dist-types/types'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types'
import {OctokitResponse} from '@octokit/types'
import deepEqual from 'deep-equal'
import {EqualMatchingInjectorConfig, It, Mock} from 'moq.ts'

import {FilesChangedReaderImpl} from '../src/files-changed-reader'
import {Repo} from '../src/github-types'

type ListFilesMethod = RestEndpointMethods['pulls']['listFiles']

describe('FilesChangedReaderImpl', () => {
  let listFilesMethod: ListFilesMethod
  let octokitMock: Mock<InstanceType<typeof GitHub>>
  let reader: FilesChangedReaderImpl

  beforeEach(() => {
    listFilesMethod = new Mock<ListFilesMethod>().object()
    octokitMock = new Mock<InstanceType<typeof GitHub>>({
      injectorConfig: new EqualMatchingInjectorConfig()
    })
    octokitMock
      .setup(instance => instance.rest.pulls.listFiles)
      .returns(listFilesMethod)
    reader = new FilesChangedReaderImpl(octokitMock.object())
  })

  describe('.read', () => {
    const repo: Repo = {owner: 'rails', repo: 'rails'}
    const prNumber = 52197

    it('returns the files changed', async () => {
      const expectedFilesChanged = [
        'actionpack/CHANGELOG.md',
        'actionpack/lib/action_controller/metal/conditional_get.rb',
        'actionpack/lib/action_dispatch/http/cache.rb',
        'actionpack/test/controller/render_test.rb'
      ]
      const response = {
        data: [{filename: 'abc.txt'}, {filename: 'def.txt'}]
      } as OctokitResponse<PaginationResults>
      const mapFnMatcher = It.Is<MapFunction>(value =>
        deepEqual(
          value(response, () => {}),
          ['abc.txt', 'def.txt']
        )
      )
      octokitMock
        .setup(instance =>
          instance.paginate(
            listFilesMethod,
            {...repo, pull_number: prNumber, per_page: 100},
            mapFnMatcher
          )
        )
        .returnsAsync(expectedFilesChanged)

      const actualFilesChanged = await reader.read(repo, prNumber)
      expect(actualFilesChanged).toEqual(expectedFilesChanged)
    })
  })
})
