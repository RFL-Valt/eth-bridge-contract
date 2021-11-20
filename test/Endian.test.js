const { BN, constants, expectRevert } = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = constants;

const { expect } = require('chai');

const EndianMock = artifacts.require('EndianMock');

contract('Endian', function (accounts) {
  beforeEach(async function () {
    this.endian = await EndianMock.new();
  });

  describe('reverse64', function () {
    it('adds correctly', async function () {
      const a = 102;

      expect((await this.endian.reverse64(a)).toString()).to.equal("7349874591868649472")
    });
  });

  describe('reverse32', function () {
    it('adds correctly', async function () {
      const a = 102;

      expect((await this.endian.reverse32(a)).toString()).to.equal("1711276032")
    });
  });

  describe('reverse16', function () {
    it('adds correctly', async function () {
      const a = 102;

      expect((await this.endian.reverse16(a)).toString()).to.equal("26112")
    });
  });

  // describe('sub', function () {
  //   it('subtracts correctly', async function () {
  //     const a = new BN('5678');
  //     const b = new BN('1234');

  //     expect(await this.safeMath.sub(a, b)).to.be.bignumber.equal(a.sub(b));
  //   });

  //   it('reverts if subtraction result would be negative', async function () {
  //     const a = new BN('1234');
  //     const b = new BN('5678');

  //     await expectRevert(this.safeMath.sub(a, b), 'SafeMath: subtraction overflow');
  //   });
  // });
});