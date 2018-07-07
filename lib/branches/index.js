const AggregateError = require('aggregate-error');
const DEFINITIONS = require('../definitions/branches');
const getError = require('../get-error');
const getTags = require('./get-tags');
const normalize = require('./normalize');

module.exports = async context => {
  const branches = await getTags(context);

  const errors = [];
  const branchesByType = Object.entries(DEFINITIONS).reduce(
    (branchesByType, [type, {filter}]) => ({[type]: branches.filter(filter), ...branchesByType}),
    {}
  );

  const result = Object.entries(DEFINITIONS).reduce((result, [type, {branchesValidator, branchValidator}]) => {
    branchesByType[type].forEach(branch => {
      if (branchValidator && !branchValidator(branch)) {
        errors.push(getError(`E${type.toUpperCase()}BRANCH`, {branch}));
      }
    });

    const branchesOfType = normalize[type](branchesByType);

    if (!branchesValidator(branchesOfType)) {
      errors.push(getError(`E${type.toUpperCase()}BRANCHES`, {branches: branchesOfType}));
    }

    return {...result, [type]: branchesOfType};
  }, {});

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }

  return [...result.lts, ...result.release, ...result.prerelease];
};
