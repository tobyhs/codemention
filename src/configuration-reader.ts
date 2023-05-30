import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import * as yaml from 'js-yaml'

import {Configuration} from './configuration'
import {Repo} from './github-types'

/**
 * @see {@link read}
 */
export default class ConfigurationReader {
  /**
   * @param octokitRest - GitHub REST API client
   */
  constructor(private readonly octokitRest: RestEndpointMethods) {}

  /**
   * Reads configuration from the given repo's .github/codemention.yml
   *
   * @param repo - repository to read configuration from
   * @param ref - branch/commit to read configuration from
   * @returns configuration
   */
  async read(repo: Repo, ref: string): Promise<Configuration> {
    const {data} = await this.octokitRest.repos.getContent({
      owner: repo.owner,
      repo: repo.repo,
      path: '.github/codemention.yml',
      ref
    })
    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString()
      return yaml.load(content) as Configuration
    }
    throw new Error('No content for .github/codemention.yml')
  }
}
