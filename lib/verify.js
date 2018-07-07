const {template, isString, isPlainObject} = require('lodash');
const pEachSeries = require('p-each-series');
const AggregateError = require('aggregate-error');
const {isGitRepo, verifyTagName, verifyBranchName} = require('./git');
const getError = require('./get-error');

module.exports = async ({cwd, env, options: {repositoryUrl, tagFormat, branches}}) => {
  const errors = [];

  if (!(await isGitRepo({cwd, env}))) {
    errors.push(getError('ENOGITREPO'), {cwd});
  } else if (!repositoryUrl) {
    errors.push(getError('ENOREPOURL'));
  }

  // Verify that compiling the `tagFormat` produce a valid Git tag
  if (!(await verifyTagName(template(tagFormat)({version: '0.0.0'})))) {
    errors.push(getError('EINVALIDTAGFORMAT', {tagFormat}));
  }

  // Verify the `tagFormat` contains the variable `version` by compiling the `tagFormat` template
  // with a space as the `version` value and verify the result contains the space.
  // The space is used as it's an invalid tag character, so it's guaranteed to no be present in the `tagFormat`.
  if ((template(tagFormat)({version: ' '}).match(/ /g) || []).length !== 1) {
    errors.push(getError('ETAGNOVERSION', {tagFormat}));
  }

  branches.forEach(branch => {
    if (
      !((isString(branch) && branch.trim()) || (isPlainObject(branch) && isString(branch.name) && branch.name.trim()))
    ) {
      errors.push(getError('EINVALIDBRANCH', {branch}));
    }
  });

  const duplicates = [...branches]
    .filter(Boolean) // Filter out falsy branch
    .map(branch => (isString(branch) ? branch : branch.name))
    .filter(Boolean) // Filter out falsy branch names
    .sort()
    .filter((val, idx, arr) => arr[idx] === arr[idx + 1] && arr[idx] !== arr[idx - 1]);

  if (duplicates.length > 0) {
    errors.push(getError('EDUPLICATEBRANCHES', {duplicates}));
  }

  await pEachSeries(branches, async branch => {
    const name = isString(branch) ? branch : branch.name;
    if (!(await verifyBranchName(name))) {
      errors.push(getError('EINVALIDBRANCHNAME', branch));
    }
  });

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
};
