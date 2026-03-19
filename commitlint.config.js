/**
 * Commitlint Configuration — KAS App
 * Enforces conventional commits: type(scope): message
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Require type from this list
    'type-enum': [2, 'always', [
      'feat',     // New feature
      'fix',      // Bug fix
      'refactor', // Code change that neither fixes nor adds
      'test',     // Adding or updating tests
      'docs',     // Documentation only
      'chore',    // Maintenance tasks
      'style',    // Formatting, whitespace
      'perf',     // Performance improvement
      'ci',       // CI/CD changes
      'build',    // Build system changes
    ]],

    // Require scope (enforces atomic commits by area)
    'scope-empty': [1, 'never'],  // Warning if no scope

    // Keep subject concise
    'subject-max-length': [2, 'always', 72],

    // No period at end
    'subject-full-stop': [2, 'never', '.'],

    // Lowercase subject
    'subject-case': [2, 'always', 'lower-case'],
  },
};
