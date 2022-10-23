require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env" });

const ALCHEMY_API_KEY_URL = process.env.ALCHEMY_API_KEY_URL;

const RINKEBY_PRIVATE_KEY = process.env.RINKEBY_PRIVATE_KEY;


const DEFAULT_BLOCK_GAS_LIMIT = 6000000;
const DEFAULT_GAS_MUL = 5;
const DEFAULT_GAS_PRICE = 2000000000;


module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: `https://rpc.ftm.tools/`,
      },
      accounts: {
        count: 3,
      }
    },
    aurora: {
      url: `https://mainnet.aurora.dev`,
      accounts: [process.env.privateKey],
    },
    fantom: {
      url: `https://rpc.ftm.tools/`,
      accounts: [process.env.privateKey],
      gasPrice: 2118876494
    },
  },
  solidity: {
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
    compilers: [
      { version: "0.8.7" },
      { version: "0.8.10" },
      { version: "0.7.6" },
      { version: "0.6.6" }
    ]
  },
};
