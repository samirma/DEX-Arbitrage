const hre = require("hardhat");

async function main() {
   [owner] = await ethers.getSigners();
   console.log(`Owner: ${owner.address}`);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
