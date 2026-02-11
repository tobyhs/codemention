import {MentionRule} from './configuration.js'

/**
 * A MentionRule that was matched to some files changed in a pull request
 */
export interface MatchedRule extends MentionRule {
  /** the files that matched this rule */
  matchedFiles: string[]
}

/**
 * A GitHub user/team that should be mentioned including metadata
 */
export interface Mention {
  /** name of user/team that should be mentioned */
  name: string

  /** files in the pull request that the user/team subscribed to */
  matchedFiles: string[]
}

/**
 * Variables that can be used in a comment template
 */
export interface TemplateContext {
  /** mention rules that matched files changed in a pull request */
  matchedRules: MatchedRule[]

  /** GitHub users/teams that should be mentioned including metadata */
  mentions: Mention[]

  /**
   * content to print above matching rules table
   *
   * @deprecated
   */
  preamble: string | undefined

  /**
   * content to print below matching rules table
   *
   * @deprecated
   */
  epilogue: string | undefined
}
