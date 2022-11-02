const { expect, assert } = require("chai");
const { BigNumber } = require("ethers");
const { ethers, waffle, artifacts } = require("hardhat");
const hre = require("hardhat");

const { DAI, DAI_WHALE, POOL_ADDRESS_PROVIDER } = require("../config");

describe("Deploy a Flash Loan", function () {
  it("Should take a flash loan and be able to return it", async function () {
    
    const contractName = 'Arb';
    await hre.run("compile");
    const smartContract = await hre.ethers.getContractFactory(contractName);

    await smartContract.deploy();

    const token = await ethers.getContractAt("IERC20", DAI);
    const BALANCE_AMOUNT_DAI = ethers.utils.parseEther("2000");
    
    const remainingBalance = await token.balanceOf(DAI_WHALE); 
    
    console.log(remainingBalance);

  });
});