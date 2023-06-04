import {beforeEach, describe, expect, it} from '@jest/globals'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import {EqualMatchingInjectorConfig, Mock} from 'moq.ts'
import * as path from 'path'

import {Configuration} from '../src/configuration'
import ConfigurationReader from '../src/configuration-reader'
import {Repo} from '../src/github-types'

describe('ConfigurationReader', () => {
  let reposMock: Mock<RestEndpointMethods['repos']>
  let reader: ConfigurationReader

  beforeEach(() => {
    reposMock = new Mock<RestEndpointMethods['repos']>({
      injectorConfig: new EqualMatchingInjectorConfig()
    })
    const octokitRestMock = new Mock<RestEndpointMethods>()
      .setup(instance => instance.repos)
      .returns(reposMock.object())
    reader = new ConfigurationReader(octokitRestMock.object())
  })

  describe('.read', () => {
    const repo: Repo = {owner: 'tobyhs', repo: 'codemention'}
    const ref: string = '7b5c561a5c3a2a2a61d7ff05c3b1dd30df4b89f9'

    const stubGetContent = function (data: {content?: string}) {
      const response = {
        data
      } as RestEndpointMethodTypes['repos']['getContent']['response']
      reposMock
        .setup(instance =>
          instance.getContent({...repo, path: '.github/codemention.yml', ref})
        )
        .returnsAsync(response)
    }

    it('returns configuration from .github/codemention.yml', async () => {
      const fileContents = fs.readFileSync(
        path.join(__dirname, 'fixtures', 'codemention.yml'),
        'utf8'
      )
      const data = {content: Buffer.from(fileContents).toString('base64')}
      stubGetContent(data)
      const expectedConfig = yaml.load(fileContents) as Configuration

      const config = await reader.read(repo, ref)
      expect(config).toEqual(expectedConfig)
    })

    describe('when the response has no content', () => {
      it('throws an error', async () => {
        stubGetContent({})
        await expect(reader.read(repo, ref)).rejects.toThrow(
          'No content for .github/codemention.yml'
        )
      })
    })
  })
})
