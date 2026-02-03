import * as core from '@actions/core'
import {Api} from '@octokit/plugin-rest-endpoint-methods'
import * as yaml from 'js-yaml'

import {Configuration} from './configuration'
import {Repo} from './github-types'

/**
 * @see {@link read}
 */
export interface ConfigurationReader {
  /**
   * Reads configuration from the given repo's .github/codemention.yml
   *
   * @param repo - repository to read configuration from
   * @param ref - branch/commit to read configuration from
   * @returns configuration
   */
  read(repo: Repo, ref: string): Promise<Configuration>
}

export class ConfigurationReaderImpl implements ConfigurationReader {
  /**
   * @param octokitRest - GitHub REST API client
   */
  constructor(private readonly octokitRest: Api['rest']) {}

  /** @override */
  async read(repo: Repo, ref: string): Promise<Configuration> {
    core.debug(`Reading codemention.yml on ${ref}`)
    const {data} = await this.octokitRest.repos.getContent({
      owner: repo.owner,
      repo: repo.repo,
      path: '.github/codemention.yml',
      ref,
    })
    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString()
      return yaml.load(content) as Configuration
    }
    throw new Error('No content for .github/codemention.yml')
  }
}
