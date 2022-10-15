const hre = require("hardhat");
require("dotenv").config({ path: "../.env" });

const wallet_address = process.env.address;

async function getImpersonatedSigner(address) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address]
  });
  return ethers.provider.getSigner(address);
}

async function main() {
   [owner] = await ethers.getSigners();
   console.log(`Owner: ${wallet_address}`);

  signer = await getImpersonatedSigner(wallet_address);

  const contractName = 'Arb';
  await hre.run("compile");
  const smartContract = await hre.ethers.getContractFactory(contractName);
  const contract = await smartContract.connect(signer).deploy();
  await contract.deployed();

  console.log(`${contractName} deployed to: ${contract.address} `); 
  console.log('Put the above contract address into the .env file under arbContract');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
