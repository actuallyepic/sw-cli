import { Octokit } from '@octokit/rest'
import { httpClient } from '@packages/http-client'
import { logger } from '@packages/logger'

export class GitHubService {
  private octokit: Octokit

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token })
    logger.info('GitHub service initialized')
  }

  async getRepo(owner: string, repo: string) {
    return this.octokit.repos.get({ owner, repo })
  }

  async createIssue(owner: string, repo: string, title: string, body: string) {
    return this.octokit.issues.create({ owner, repo, title, body })
  }
}