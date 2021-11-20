const { expect } = require('chai');
const Token = artifacts.require("Token");
const TokenMockup = artifacts.require("ERC20Mock");
const { constants, expectRevert } = require('@openzeppelin/test-helpers');

const wei = web3.utils.toWei;
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

contract("Token", (accounts) => {
  let token;
  const tokenName = "FENNECT";
  const tokenSymbol = "FENNECT";
  const totalSupply = wei("1000000000", "ether");
  before(async() => {
    [owner, addr1, addr2, recipient1] = accounts;
    token = await Token.new();
    tokenMockup = await TokenMockup.new();
  })

  it("Token has a name", async () => {
    expect(await token.name()).to.equal(tokenName);
  })

  it("Token has a symbol", async () => {
    expect(await token.symbol()).to.equal(tokenSymbol);
  })

  it("Token has a decimals", async () => {
    expect( (await token.decimals()).toString() ).to.equal("18");
  })

  it("Initial supply", async () => {
    expect( (await token.totalSupply()).toString() ).to.equal(totalSupply);
  })

  it("Set up decimals", async () => {
    await tokenMockup.setupDecimals(15);
    expect( (await tokenMockup.decimals()).toString() ).to.equal("15");
  })

  it("msgData", async () => {
    let testData = await tokenMockup.msgData({data: "0x001"});
    expect(testData).to.equal("0xc4c2bfdc");
  })

  it("Test allowance", async () => {
    expect( (await token.allowance(owner, addr1)).toString() ).to.equal("0");
  })

  it("Increase allowance", async () => {
    await token.increaseAllowance(addr1, 100);
    expect( (await token.allowance(owner, addr1)).toString() ).to.equal("100");
  })

  it("Decrease allowance", async () => {
    await token.increaseAllowance(addr1, 300);
    expect( (await token.allowance(owner, addr1)).toString() ).to.equal("400");

    await token.decreaseAllowance(addr1, 100);
    expect( (await token.allowance(owner, addr1)).toString() ).to.equal("300");
  })

  it("Mint should failed for zero address", async () => {
    await expectRevert(tokenMockup.mint(ZERO_ADDRESS, 100), "ERC20: mint to the zero address");
  })

  it("Transfer should failed if sent to zero address", async() => {
    await expectRevert(tokenMockup.transfer(ZERO_ADDRESS, 100), "ERC20: transfer to the zero address");
  })

  it("Transfer should failed if sent from zero address", async() => {
    await expectRevert(tokenMockup.transferSenderZeroMockup(ZERO_ADDRESS, 100), "ERC20: transfer from the zero address");
  })

  it("Approve should faild if sent to zero address", async() => {
    await expectRevert(tokenMockup.approve(ZERO_ADDRESS, 100), "ERC20: approve to the zero address");
  })

  it("Approve should faild if sent to zero address", async() => {
    await expectRevert(tokenMockup.approveSenderZeroMockup(ZERO_ADDRESS, 100), "ERC20: approve from the zero address");
  })
})