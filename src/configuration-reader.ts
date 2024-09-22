import * as core from '@actions/core'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import * as yaml from 'js-yaml'

import {Configuration, MentionRule} from './configuration'
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

export class CodementionYamlConfigurationReaderImpl
  implements ConfigurationReader
{
  /**
   * @param octokitRest - GitHub REST API client
   */
  constructor(private readonly octokitRest: RestEndpointMethods) {}

  /** @override */
  async read(repo: Repo, ref: string): Promise<Configuration> {
    core.debug(`Reading codemention.yml on ${ref}`)
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

export class CodementionCodeownersLikeFormatFileConfigurationReaderImpl
  implements ConfigurationReader
{
  /**
   * @param octokitRest - GitHub REST API client
   */
  constructor(private readonly octokitRest: RestEndpointMethods) {}

  /** @override */
  async read(repo: Repo, ref: string): Promise<Configuration> {
    core.debug(`Reading CODEMENTION on ${ref}`)
    const {data} = await this.octokitRest.repos.getContent({
      owner: repo.owner,
      repo: repo.repo,
      path: '.github/CODEMENTION',
      ref
    })
    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString()
      return CodementionCodeownersLikeFormatFileConfigurationReaderImpl.parseCodeownersLikeFile(
        content
      )
    }
    throw new Error('No content for .github/CODEMENTION')
  }

  private static parseCodeownersLikeFile(fileContent: string): Configuration {
    const filteredFileLines = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => !!line)
      .filter(line => !line.startsWith('#'))

    if (filteredFileLines.some(line => line.startsWith('!'))) {
      throw new Error('Unsupported negation in CODEMENTION: `!`')
    }

    return {
      rules: filteredFileLines.map(line =>
        this.parseCodeownersLikeFileLine(line)
      )
    }
  }

  private static parseCodeownersLikeFileLine(line: string): MentionRule {
    const lineParts = line
      .split(/(?<!\\)\s/)
      .map(part => part.trim())
      .filter(part => !!part)
    if (lineParts.length < 2) {
      throw new Error(
        `Unsupported line in CODEMENTION, must have a path and at least one author: ${line}`
      )
    }

    const [pattern, ...mentions] = lineParts

    return {
      patterns: [pattern],
      mentions: mentions.map(mention => mention.replace('@', ''))
    }
  }
}
