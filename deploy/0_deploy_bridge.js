module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const rfox = process.env.RFOX_ADDRESS;
  if (!rfox) {
    throw new Error('RFOX not defined');
  }
  // Deploy contract
  await deploy('ETHWAXBRIDGE', {
    from: deployer,
    log: true,
    owner: deployer,
    args: [rfox],
    deterministicDeployment: false,
  });
};

module.exports.tags = ['ETHWAXBRIDGE'];
