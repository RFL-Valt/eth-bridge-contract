const { expect } = require('chai');

const { Serialize } = require('eosjs');

const { expectRevert } = require("@openzeppelin/test-helpers");

const fromHexString = (hexString) =>
  new Uint8Array(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

const toHexString = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

const getSignData = (id, ts, eosAddress, quantity, chainId, ethAddress) => {
  const sb = new Serialize.SerialBuffer({
    textEncoder: new TextEncoder(),
    textDecoder: new TextDecoder(),
  });
  sb.pushNumberAsUint64(id);
  sb.pushUint32(ts);
  sb.pushName(eosAddress);
  sb.pushAsset(quantity + ' TLM');
  sb.push(chainId);
  sb.pushArray(fromHexString(ethAddress));
  return '0x' + toHexString(sb.array.slice(0, 69));
};

describe('ETHWAXBRIDGE', function () {
  let rfox;
  let bridge;
  let owner, alice, bob, oracle;
  let chainId;
  beforeEach(async () => {
    [owner, alice, bob, oracle] = await ethers.getSigners();
    // We get the RFOX contract to deploy
    const RFOX = await hre.ethers.getContractFactory('Token');
    rfox = await RFOX.deploy();
    await rfox.deployed();

    // We get the token Bridge contract to deploy
    const Bridge = await hre.ethers.getContractFactory('ETHWAXBRIDGE');
    bridge = await Bridge.deploy(rfox.address);
    await bridge.deployed();

    const network = await hre.ethers.provider.getNetwork();
    chainId = network.chainId;
  });

  it('Should return owner is deployer address', async function () {
    const contractOwner = await bridge.owner();

    expect(contractOwner).to.be.equal(owner.address);
  });

  it('Should correct token address', async function () {
    const rfoxAddress = await bridge.rfox();

    expect(rfoxAddress).to.be.equal(rfox.address);
  });

  it('Should correct threshold', async function () {
    const threshold = await bridge.threshold();

    expect(threshold).to.be.equal(3);
  });

  it('Should revert accept ownership did not call by alice', async function () {
    await bridge.transferOwnership(alice.address);
    await expectRevert.unspecified(bridge.connect(bob).acceptOwnership());
    const contractOwner = await bridge.owner();

    expect(contractOwner).to.be.equal(owner.address);
  });

  it('Should change the owner to alice', async function () {
    await bridge.transferOwnership(alice.address);
    await bridge.connect(alice).acceptOwnership();
    const contractOwner = await bridge.owner();

    expect(contractOwner).to.be.equal(alice.address);
  });

  it('Bob can not change owner', async function () {
    const transferOwner = bridge.connect(bob).transferOwnership(bob.address);

    await expect(transferOwner).to.be.revertedWith('Only owner can call');
  });

  it('Owner can register Oracle', async function () {
    await bridge.regOracle(oracle.address);
    const isOracle = await bridge.oracles(oracle.address);

    expect(isOracle).to.be.equal(true);
  });

  it('Alice can not register Oracle', async function () {
    await expect(
      bridge.connect(alice).regOracle(oracle.address),
    ).to.be.revertedWith('Only owner can call');
  });

  it('Owner can unregister Oracle', async function () {
    await bridge.regOracle(oracle.address);
    await bridge.unregOracle(oracle.address);
    const isOracle = await bridge.oracles(oracle.address);

    expect(isOracle).to.be.equal(false);
  });

  it('Alice can not unregister Oracle', async function () {
    await bridge.regOracle(oracle.address);
    await expect(bridge.connect(alice).unregOracle(oracle.address)).to.be
      .reverted;
    const isOracle = await bridge.oracles(oracle.address);

    expect(isOracle).to.be.equal(true);
  });

  it('Alice can bridge token', async function () {
    await rfox.transfer(alice.address, 100000);
    await rfox.connect(alice).approve(bridge.address, 100000);

    await bridge.connect(alice).bridge('eos.address', 100000, chainId);
  });

  it('Alice cannot bridge if not approve token', async function () {
    await rfox.transfer(alice.address, 100000);

    await expect(bridge.connect(alice).bridge('eos.address', 100000, chainId))
      .to.be.reverted;
  });

  it('Alice cannot bridge if not approve token', async function () {
    await rfox.transfer(alice.address, 100000);

    await expect(bridge.connect(alice).bridge('eos.address', 100000, chainId))
      .to.be.reverted;
  });

  it('Bridge emit bridge event', async function () {
    await rfox.transfer(alice.address, 100000);
    await rfox.connect(alice).approve(bridge.address, 100000);

    await expect(
      bridge.connect(alice).bridge('eos.address', 100000, chainId),
    ).to.emit(bridge, 'Bridge');
  });

  it('Bridge emit locked event', async function () {
    await rfox.transfer(alice.address, 100000);
    await rfox.connect(alice).approve(bridge.address, 100000);

    await expect(
      bridge.connect(alice).bridge('eos.address', 100000, chainId),
    ).to.emit(bridge, 'Locked');
  });

  it('Alice balance decrease when bridge', async function () {
    await rfox.transfer(alice.address, 100000);
    await rfox.connect(alice).approve(bridge.address, 100000);

    const balance = await rfox.balanceOf(alice.address);
    const bridgeTransaction = bridge
      .connect(alice)
      .bridge('eos.address', 100000, chainId);

    await expect(bridgeTransaction).to.emit(bridge, 'Locked');
    await expect(bridgeTransaction).to.emit(bridge, 'Bridge');

    await bridgeTransaction;

    const afterBalance = await rfox.balanceOf(alice.address);

    expect(afterBalance).to.be.equal(balance - 100000);
  });

  it('No one can transfer locked token', async function () {
    await rfox.transfer(alice.address, 100000);
    await rfox.connect(alice).approve(bridge.address, 100000);
    await bridge.connect(alice).bridge('eos.address', 100000, chainId);

    await expect(
      bridge.connect(alice).transferAnyERC20Token(rfox.address, 1000),
    ).to.be.reverted;
    await expect(bridge.transferAnyERC20Token(rfox.address, 1000)).to.be
      .reverted;
  });

  it('Verify Signature Works', async function () {
    let id = 0;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      chainId,
      owner.address.replace('0x', ''),
    );
    expect(hre.ethers.utils.isBytesLike(data)).to.be.equal(true);
  });

  it('Verify Signature Works', async function () {
    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      chainId,
      owner.address.replace('0x', ''),
    );
    expect(hre.ethers.utils.isBytesLike(data)).to.be.equal(true);
  });
  it('Verify Signature Works', async function () {
    let id = 2;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      chainId,
      owner.address.replace('0x', ''),
    );
    expect(hre.ethers.utils.isBytesLike(data)).to.be.equal(true);
  });
  it('Verify Signature Works', async function () {
    let id = 3;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      chainId,
      owner.address.replace('0x', ''),
    );
    expect(hre.ethers.utils.isBytesLike(data)).to.be.equal(true);
  });
});
