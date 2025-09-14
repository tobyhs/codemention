import {MentionRule} from './configuration'

/**
 * A MentionRule that was matched to some files changed in a pull request
 */
export interface MatchedRule extends MentionRule {
  /** the files that matched this rule */
  matchedFiles: string[]
}
