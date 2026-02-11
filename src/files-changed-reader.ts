import * as core from '@actions/core'
import {GitHub} from '@actions/github/lib/utils'

import {Repo} from './github-types.js'

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
   * @param octokit - GitHub API client
   */
  constructor(private readonly octokit: InstanceType<typeof GitHub>) {}

  /** @override */
  async read(repo: Repo, pullNumber: number): Promise<string[]> {
    const filesChanged = await this.octokit.paginate(
      this.octokit.rest.pulls.listFiles,
      {
        owner: repo.owner,
        repo: repo.repo,
        pull_number: pullNumber,
        per_page: 100,
      },
      response => response.data.map(file => file.filename),
    )
    core.debug(`Files changed: ${filesChanged}`)
    return filesChanged
  }
}
