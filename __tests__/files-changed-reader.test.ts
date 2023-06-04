import {beforeEach, describe, expect, it} from '@jest/globals'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import * as fs from 'fs'
import {EqualMatchingInjectorConfig, Mock} from 'moq.ts'
import * as path from 'path'

import FilesChangedReader from '../src/files-changed-reader'
import {Repo} from '../src/github-types'

describe('FilesChangedReader', () => {
  let pullsMock: Mock<RestEndpointMethods['pulls']>
  let reader: FilesChangedReader

  beforeEach(() => {
    pullsMock = new Mock<RestEndpointMethods['pulls']>({
      injectorConfig: new EqualMatchingInjectorConfig()
    })
    const octokitRestMock = new Mock<RestEndpointMethods>()
      .setup(instance => instance.pulls)
      .returns(pullsMock.object())
    reader = new FilesChangedReader(octokitRestMock.object())
  })

  describe('.read', () => {
    const repo: Repo = {owner: 'vanilla-music', repo: 'vanilla'}

    it('returns the files changed', async () => {
      const diff = fs.readFileSync(
        path.join(__dirname, 'fixtures', 'pull.diff'),
        'utf8'
      )
      const response = {
        data: diff
      } as unknown as RestEndpointMethodTypes['pulls']['get']['response']
      pullsMock
        .setup(instance =>
          instance.get({...repo, pull_number: 868, mediaType: {format: 'diff'}})
        )
        .returnsAsync(response)

      const filesChanged = await reader.read(repo, 868)
      filesChanged.sort()
      expect(filesChanged).toEqual([
        'app/src/main/java/ch/blinkenlights/android/vanilla/JumpToTimeDialog.java',
        'app/src/main/java/ch/blinkenlights/android/vanilla/PlaybackActivity.java',
        'app/src/main/java/ch/blinkenlights/android/vanilla/PlaybackService.java',
        'app/src/main/java/ch/blinkenlights/android/vanilla/SlidingPlaybackActivity.java',
        'app/src/main/res/layout/duration_input.xml',
        'app/src/main/res/values/translatable.xml'
      ])
    })
  })
})
