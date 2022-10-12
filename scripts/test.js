const { expect, assert } = require("chai");
const { BigNumber } = require("ethers");
const { ethers, waffle, artifacts } = require("hardhat");
const hre = require("hardhat");

const { DAI, DAI_WHALE, POOL_ADDRESS_PROVIDER } = require("../config");

async function main() {
  const flashLoanExample = await ethers.getContractFactory(
    "Arb"
  );

  const _flashLoanExample = await flashLoanExample.deploy();
  await _flashLoanExample.deployed();
  
  const a = await _flashLoanExample.test();

  console.log(a);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

