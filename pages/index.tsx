import React, { useCallback, useEffect, useState } from 'react';
import { BigNumber } from 'bignumber.js';
import { StableToken } from '@celo/contractkit';
import { useContractKit } from '@celo-tools/use-contractkit';
import Web3 from 'web3';
import hawalaJson from '../truffle/build/contracts/HawalaCoin.json';
import Head from 'next/head';
import { ContractButton, PrimaryButton } from '../components/buttons';
import { toast } from '../components';

const defaultSummary = {
  name: '',
  address: '',
  wallet: '',
  celo: new BigNumber(0),
};
const defaultGasPrice = 100000000000;
const ERC20_DECIMALS = 18;

function truncateAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(36)}`;
}

export default function Home(): React.ReactElement {
  const {
    kit,
    address,
    network,
    updateNetwork,
    connect,
    destroy,
    performActions,
    walletType,
  } = useContractKit();
  const [summary, setSummary] = useState(defaultSummary);
  const [transacting, setTransacting] = useState(false);
  const [role, setRole] = useState(0);
  const [balances, setBalances] = useState([]);

  // TODO Move these to configs
  // Alfajores
  const hawalaAddress = '0x48f6848cA5737A94902772f48bA894E1b8F9A848';
  const hawalaAbi: any = hawalaJson.abi; // hack to fix abi types
  const hawalaContract = new kit.web3.eth.Contract(hawalaAbi, hawalaAddress);

  /**
   * Fetches account summary and token balances
   */
  const fetchSummary = useCallback(async () => {
    if (!address) {
      setSummary(defaultSummary);
      return;
    }

    const [accounts, goldToken] = await Promise.all([
      kit.contracts.getAccounts(),
      kit.contracts.getGoldToken(),
    ]);
    const [summary, celo] = await Promise.all([
      accounts.getAccountSummary(address).catch((e) => {
        console.error(e);
        return defaultSummary;
      }),
      goldToken.balanceOf(address)
    ]);
    await fetchTokenBalances();
    setSummary({
      ...summary,
      celo
    });
  }, [address, kit]);

  /**
   * Gets the balance of the latest token
   * TODO eventually this should support all tokens with a way to select which one
   */
  async function fetchTokenBalances(): Promise<void> {
    if (!address) {
      setBalances([]);
      return;
    }
    // TODO make call to get most recent token - for now hardcoding
    setTokenId(0);
    const balances = await hawalaContract.methods.balanceOfBatch([address], [0]).call();
    setBalances(balances);
  }

  /**
   * Calls the HawalaCoin contract to get the role assigned to the current address
   */
  async function fetchRole() {
    if (!address) {
      setRole(0);
      return;
    }
    const role = await hawalaContract.methods.users(address).call();
    console.log(role);
    setRole(parseInt(role, 10));
  }

  /**
   * Wrapper function for contract calls to handle the transacting flag and errors
   */
  async function wrapContractCall(fn: (...args: any) => Promise<void>, ...args: any) {
    try {
      setTransacting(true);
      await fn(...args);
    } catch (e) {
      console.log(e);
      toast.error((e as Error).message);
    } finally {
      setTransacting(false);
    }
  }

  /** 
   * Adds a new role:
   * 0 - None
   * 1 - Donor
   * 2 - Client
   * 3 - CSO
   * 4 - Agent
   */
  async function addRole(inputAddress: string, role: number): Promise<void> {
    if (!inputAddress) {
      return;
    }
    const txObject = await hawalaContract.methods.addUser(inputAddress, role); 
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
  }

  /** 
   * Mints new tokens which are tied to a specific client which will be able to redeem/burn them
   */
  async function mint(clientAddress: string, amount: number): Promise<void> {
    if (!clientAddress || amount <= 0) {
      return;
    }
    const txObject = await hawalaContract.methods.mint(kit.defaultAccount, clientAddress, amount);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  /** 
   * Calls the safeTransfer function on the ERC-1155 contract to transfer an amount of tokens to another address
   */
  async function transfer(targetAddress: string, token: number, amount: number): Promise<void> {
    console.log(`${kit.defaultAccount} ${targetAddress}  ${token}  ${amount}`);
    const txObject = await hawalaContract.methods.safeTransferFrom(kit.defaultAccount, targetAddress, token, amount, []);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  /**
   * Burns a number of tokens, done by the client in response to the Agent collecting money
   */
  async function burn(tokenId: number, amount: number) {
    if (tokenId <= 0 || amount <= 0) {
      return;
    }
    const txObject = await hawalaContract.methods.burn(kit.defaultAccount, tokenId, amount);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  function RoleView() {
    switch(role) {
      case 0:
        return (<UnassignedView />);;
      case 1:
        return (<DonorView />);
      case 2:
        return (<ClientView />);;
      case 3:
        return (<CsoView />);;
      case 4:
        return (<AgentView />);;
      default:
        return (<DonorView />);;
    }
  }

  const [clientAddress, setClientAddress] = useState('');
  const [mintAmount, setMintAmount] = useState(100.00);
  const [csoAddress, setCsoAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState(100.00);
  const [tokenId, setTokenId] = useState(0);

  function DonorView() {
    return (
      <div>
        <div className="font-bold py-2">Welcome Donor</div>
        <div>Add the address of the Client you will send USD to</div>
        <div>
          <input className="bg-blue border-2 w-96" type="text" placeholder="Client Address" value={clientAddress} onChange={(event: any) => {
            setClientAddress(event.target.value);
          }}></input>
          <ContractButton disabled={transacting} onClick={() => wrapContractCall(() => addRole(clientAddress, 2))} children="Add Client" />
        </div>
        <div> </div>
        <div>Transfer USD to the Client, then mint representative tokens</div>
        <div>
          <input className="bg-blue border-2 w-96" type="text" placeholder="100.00" value={mintAmount} onChange={(event: any) => {
            setMintAmount(event.target.value);
          }}></input>
          <ContractButton disabled={transacting} onClick={() => wrapContractCall(() => mint(clientAddress, mintAmount))} children="Mint Tokens" />
        </div>
        <div> </div>
        <div>Add the address of the CSO who will receive the tokens</div>
        <div>
          <input className="bg-blue border-2 w-96" type="text" placeholder="CSO Address" value={csoAddress} onChange={(event: any) => {
            setCsoAddress(event.target.value);
          }}></input>
          <ContractButton disabled={transacting} onClick={() => wrapContractCall(() => addRole(csoAddress, 3))} children="Add CSO" />
        </div>
        <div> </div>
        <div>Transfer tokens to CSO</div>
        <div>
          <input className="bg-blue border-2 w-96" type="text" placeholder="100.00" value={transferAmount} onChange={(event: any) => {
            setTransferAmount(event.target.value);
          }}></input>
          <ContractButton disabled={transacting} onClick={() => wrapContractCall(() => transfer(csoAddress, tokenId, transferAmount))} children="Transfer to CSO" />
        </div>
      </div>
    );
  }

  function ClientView() {
    return (
      <div>
        <div>Welcome Client</div>
      </div>
    );
  }

  function CsoView() {
    return (
      <div>
        <div>Welcome CSO</div>
      </div>
    );
  }

  function AgentView() {
    return (
      <div>
        <div>Agent Donor</div>
      </div>
    );
  }

  function UnassignedView() {
    return (
      <div>
        <div>Your address doesn't have a role assigned</div>
      </div>
    );
  }

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchRole();
  }, [fetchRole]);

  return (
    <div>
      <Head>
        <title>HawalaCoin</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="max-w-screen-sm mx-auto py-10 md:py-20 px-4">
          <h1 className="font-bold text-gray-700">Hawala Coin</h1>
          {address ? 
            (<PrimaryButton onClick={() => 
              destroy().catch((e) => toast.error((e as Error).message))
            }>Disconnect</PrimaryButton>)
            : 
            (<PrimaryButton onClick={() =>
                connect().catch((e) => toast.error((e as Error).message))
            }>Connect</PrimaryButton>)
          }
          {address && (
            <div>
              <div className="text-gray-600 border-2">
                <div>Wallet Information</div>
                <div>Network: {network.name}</div>
                <div>Address: {truncateAddress(address)}</div>
                <div>Celo: {Web3.utils.fromWei(summary.celo.toFixed())}</div>
                {balances.map((balance, tokenId) =>
                  <div key={tokenId}>Token{tokenId}: {balance}</div>
                )}
              </div>
              <div>
                <RoleView />
              </div>
            </div>
          )}
      </main>
    </div>
  )
}
