const hre = require("hardhat");
require("dotenv").config({ path: "../.env" });
const lib = require("./trade_lib");

async function main() {

	const owner = await lib.getSignerOwner();
	const wallet_address = await owner.getAddress()
	console.log(`Owner: ${wallet_address} `);

  const contractName = 'Arb';
  await hre.run("compile");
  const smartContract = await hre.ethers.getContractFactory(contractName);
  const contract = await smartContract.connect(owner).deploy();
  await contract.deployed();

  console.log(`${contractName} deployed to: ${contract.address} `); 
  console.log('Put the above contract address into the bsc.json file under arbContract');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
