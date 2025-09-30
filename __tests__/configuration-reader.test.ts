import {beforeEach, describe, expect, it} from '@jest/globals'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import * as fs from 'fs'
import {MockProxy, mockDeep} from 'jest-mock-extended'
import * as yaml from 'js-yaml'
import * as path from 'path'

import {Configuration} from '../src/configuration'
import {ConfigurationReaderImpl} from '../src/configuration-reader'
import {Repo} from '../src/github-types'
import {deepEqualsMatch} from './matchers'

describe('ConfigurationReaderImpl', () => {
  let reposMock: MockProxy<RestEndpointMethods['repos']>
  let reader: ConfigurationReaderImpl

  beforeEach(() => {
    const octokitRest = mockDeep<RestEndpointMethods>()
    reposMock = octokitRest.repos
    reader = new ConfigurationReaderImpl(octokitRest)
  })

  describe('.read', () => {
    const repo: Repo = {owner: 'tobyhs', repo: 'codemention'}
    const ref = '7b5c561a5c3a2a2a61d7ff05c3b1dd30df4b89f9'

    const stubGetContent = function (data: {content?: string}): void {
      const response = {
        data,
      } as RestEndpointMethodTypes['repos']['getContent']['response']
      reposMock.getContent
        .calledWith(
          deepEqualsMatch({...repo, path: '.github/codemention.yml', ref}),
        )
        .mockResolvedValue(response)
    }

    it('returns configuration from .github/codemention.yml', async () => {
      const fileContents = fs.readFileSync(
        path.join(__dirname, 'fixtures', 'codemention.yml'),
        'utf8',
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
          'No content for .github/codemention.yml',
        )
      })
    })
  })
})
