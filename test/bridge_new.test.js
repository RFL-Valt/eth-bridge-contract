const { expect } = require('chai');

const BridgeMock = artifacts.require("BridgeMock");
const { constants, expectRevert, BN } = require('@openzeppelin/test-helpers');
const Token = artifacts.require("Token");

const wei = web3.utils.toWei;

const { Serialize } = require('eosjs');
const fromHexString = (hexString) =>
  new Uint8Array(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

const toHexString = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

contract("Bridge", (accounts) => {
  let initialThreshold;
  beforeEach(async() => {
    [owner, addr1, addr2, recipient1] = accounts;
    token = await Token.new();
    bridgeMock = await BridgeMock.new(token.address);
    initialThreshold = new BN(3);
    await token.transfer(bridgeMock.address, wei("1000", "ether"));
    await bridgeMock.regOracle(owner)
  })

  it("onlyOracle modifier should revert if called by unauthorized", async() => {
    await expectRevert(bridgeMock.testOnlyOracleModifier({from: addr1}), "Account is not a registered oracle");
  })

  it("onlyOracle modifier success", async() => {
    expect( (await bridgeMock.testOnlyOracleModifier()).toString()).to.equal("0");
  })

  it("Should revert if try to register address which already registered", async () => {
    await expectRevert(bridgeMock.regOracle(owner), "Oracle is already registered");
  })

  it("Should revert if try to remove address that does not exist as oracle", async () => {
    await expectRevert(bridgeMock.unregOracle(addr1), "Oracle is not registered");
  })

  it("Release All token", async() => {
    const amount = wei("10", "ether");
    const prevTotalLocked = await bridgeMock.totalLocked();
    expect(prevTotalLocked.toString()).to.equal("0");
    
    await expectRevert(bridgeMock.internalRelease(owner, amount), "SafeMath: subtraction overflow");

    await bridgeMock.addTotalLocked(amount);
    await bridgeMock.internalRelease(owner, amount);
    const newTotalLocked = await bridgeMock.totalLocked();
    expect(await newTotalLocked.toString()).to.equal("0");
  })

  it("Release Partial token", async() => {
    const amount = wei("10", "ether");
    const prevTotalLocked = await bridgeMock.totalLocked();
    expect(prevTotalLocked.toString()).to.equal("0");
    
    await expectRevert(bridgeMock.internalRelease(owner, amount), "SafeMath: subtraction overflow");

    await bridgeMock.addTotalLocked(amount);
    await bridgeMock.internalRelease(owner, wei("5", "ether"));
    const newTotalLocked = await bridgeMock.totalLocked();
    expect(await newTotalLocked.toString()).to.equal(wei("5","ether"));
  })

  it("Update threshold revert unauthorized", async() => {
    await expectRevert(bridgeMock.updateThreshold(0, {from: addr1}), "Only owner can call");
  })

  it("Update threshold by 0", async() => {
    const prevThreshold = await bridgeMock.threshold();
    await bridgeMock.updateThreshold(0);
    const newThreshold = await bridgeMock.threshold();
    expect(prevThreshold.toString()).to.equal(initialThreshold.toString());
    expect(prevThreshold.toString()).to.equal(newThreshold.toString());
  })

  it("Update threshold", async() => {
    const prevThreshold = await bridgeMock.threshold();
    const newThresholdValue = new BN(5);
    await bridgeMock.updateThreshold(newThresholdValue);
    const newThreshold = await bridgeMock.threshold();
    expect(prevThreshold.toString()).to.equal(initialThreshold.toString());
    expect(newThreshold.toString()).to.equal(newThresholdValue.toString());
  })

  it("Update threshold > 10", async() => {
    const newThresholdValue = new BN(11);
    await expectRevert(bridgeMock.updateThreshold(newThresholdValue), "Threshold has maximum of 10");
  })

  it("Claim should revert for invalid chain id", async() => {
    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      100,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig = await web3.eth.sign(web3.utils.sha3(data), owner);

    await expectRevert(bridgeMock.claim(data, [sig]), "Invalid Chain ID");
  })

  it("Claim should revert for bridge has expired", async() => {
    let id = 1;
    let timestamp = parseInt((Date.now() / 1000) - 100000000000000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      105,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig = await web3.eth.sign(web3.utils.sha3(data), owner);

    await bridgeMock.addTotalLocked(wei("1000", "ether"));
    await bridgeMock.updateThreshold(1);
    expect( (await bridgeMock.threshold()).toString() ).to.equal("1");
    await expectRevert(bridgeMock.claim(data, [sig]), "Bridge has expired");
  })

  it("Prevent double claimed", async() => {
    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      105,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig = await web3.eth.sign(web3.utils.sha3(data), owner);

    await bridgeMock.addTotalLocked(wei("1000", "ether"));
    await bridgeMock.updateThreshold(1);
    expect( (await bridgeMock.threshold()).toString() ).to.equal("1");
    await bridgeMock.claim(data, [sig]);
    expect( (await token.balanceOf(addr1)).toString() ).to.equal(wei("10", "ether"));

    await expectRevert(bridgeMock.claim(data, [sig]), "Already Claimed");
  })

  it("Invalid signatures provided", async() => {
    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      105,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig = await web3.eth.sign(web3.utils.sha3(data), owner);

    await bridgeMock.addTotalLocked(wei("1000", "ether"));
    await expectRevert(bridgeMock.claim(data, [sig]), "Not enough valid signatures provided");
  })

  it("Signature more than 10", async() => {
    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      105,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig = await web3.eth.sign(web3.utils.sha3(data), owner);

    await bridgeMock.addTotalLocked(wei("1000", "ether"));
    await bridgeMock.updateThreshold(1);
    expect( (await bridgeMock.threshold()).toString() ).to.equal("1");
    await expectRevert(bridgeMock.claim(data, [sig,sig,sig,sig,sig,sig,sig,sig,sig,sig,sig]), "Maximum of 10 signatures can be provided");
  })

  it("Claim with 10 Signatures", async() => {
    await bridgeMock.regOracle(accounts[1]);
    await bridgeMock.regOracle(accounts[2]);
    await bridgeMock.regOracle(accounts[3]);
    await bridgeMock.regOracle(accounts[4]);
    await bridgeMock.regOracle(accounts[5]);
    await bridgeMock.regOracle(accounts[6]);
    await bridgeMock.regOracle(accounts[7]);
    await bridgeMock.regOracle(accounts[8]);
    await bridgeMock.regOracle(accounts[9]);

    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      105,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig1 = await web3.eth.sign(web3.utils.sha3(data), owner);
    const sig2 = await web3.eth.sign(web3.utils.sha3(data), accounts[1]);
    const sig3 = await web3.eth.sign(web3.utils.sha3(data), accounts[2]);
    const sig4 = await web3.eth.sign(web3.utils.sha3(data), accounts[3]);
    const sig5 = await web3.eth.sign(web3.utils.sha3(data), accounts[4]);
    const sig6 = await web3.eth.sign(web3.utils.sha3(data), accounts[5]);
    const sig7 = await web3.eth.sign(web3.utils.sha3(data), accounts[6]);
    const sig8 = await web3.eth.sign(web3.utils.sha3(data), accounts[7]);
    const sig9 = await web3.eth.sign(web3.utils.sha3(data), accounts[8]);
    const sig10 = await web3.eth.sign(web3.utils.sha3(data), accounts[9]);

    await bridgeMock.addTotalLocked(wei("1000", "ether"));
    expect(await bridgeMock.claim(data, [sig1,sig2,sig3,sig4,sig5,sig6,sig7,sig8,sig9,sig10]));
  })

  it("Wrong signature", async() => {
    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      105,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig = await web3.eth.sign(web3.utils.sha3(data), addr1);

    await bridgeMock.addTotalLocked(wei("1000", "ether"));
    await bridgeMock.updateThreshold(1);
    expect( (await bridgeMock.threshold()).toString() ).to.equal("1");
    await expectRevert(bridgeMock.claim(data, [sig]), "Not enough valid signatures provided");
  })

  it("Claim with wrong data length", async() => {
    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      105,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig = await web3.eth.sign(web3.utils.sha3(data), owner);

    await bridgeMock.addTotalLocked(wei("1000", "ether"));
    await bridgeMock.updateThreshold(1);
    expect( (await bridgeMock.threshold()).toString() ).to.equal("1");
    await expectRevert(bridgeMock.claim(data.substring(0, data.length - 2), [sig]), "Signature data is the wrong size");
  })

  it("Claim", async() => {
    let id = 1;
    let timestamp = parseInt(Date.now() / 1000);
    let quantity = 1000000000;
    let eosAddress = 'new.dex';
    const toAddress = addr1.substring(2);

    const data = getSignData(
      id,
      timestamp,
      eosAddress,
      quantity,
      105,
      toAddress
    );

    expect( (await token.balanceOf(addr1)).toString() ).to.equal("0");
    const sig = await web3.eth.sign(web3.utils.sha3(data), owner);

    await bridgeMock.addTotalLocked(wei("1000", "ether"));
    await bridgeMock.updateThreshold(1);
    expect( (await bridgeMock.threshold()).toString() ).to.equal("1");
    await bridgeMock.claim(data, [sig]);
    expect( (await token.balanceOf(addr1)).toString() ).to.equal(wei("10", "ether"));
  })

  it("fallback function should revert", async() => {
    await expectRevert.unspecified(
			bridgeMock.send(wei("0.0000000000000001", "ether")),
		);
  })
})

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