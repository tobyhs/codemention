import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import parseDiff from 'parse-diff'

import {Repo} from './github-types'

/**
 * @see {@link read}
 */
export interface FilesChangedReader {
  /**
   * Lists the files changed in a pull request
   *
   * @param repo - repository that the pull request is in
   * @param pullNumber - number that identifies the pull request
   * @returns the files changed
   */
  read(repo: Repo, pullNumber: number): Promise<string[]>
}

export class FilesChangedReaderImpl implements FilesChangedReader {
  /**
   * @param octokitRest - GitHub REST API client
   */
  constructor(private readonly octokitRest: RestEndpointMethods) {}

  /** @override */
  async read(repo: Repo, pullNumber: number): Promise<string[]> {
    const response = await this.octokitRest.pulls.get({
      owner: repo.owner,
      repo: repo.repo,
      pull_number: pullNumber,
      mediaType: {format: 'diff'}
    })
    const diff = response.data as unknown as string
    const files = parseDiff(diff)

    const filesChanged = new Set<string>()
    for (const file of files) {
      if (file.from !== undefined) {
        filesChanged.add(file.from)
      }
      if (file.to !== undefined) {
        filesChanged.add(file.to)
      }
    }
    filesChanged.delete('/dev/null')
    return [...filesChanged]
  }
}
