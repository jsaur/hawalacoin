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
  cusd: new BigNumber(0)
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
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(0);
  const [inputAddress, setInputAddress] = useState('');
  

  // TODO Move these to configs
  // Alfajores
  const hawalaAddress = '0x48f6848cA5737A94902772f48bA894E1b8F9A848';
  const cusdAddress = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1';
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

    const [accounts, goldToken, cUSD] = await Promise.all([
      kit.contracts.getAccounts(),
      kit.contracts.getGoldToken(),
      kit.contracts.getStableToken(StableToken.cUSD),
    ]);
    const [summary, celo, cusd] = await Promise.all([
      accounts.getAccountSummary(address).catch((e) => {
        console.error(e);
        return defaultSummary;
      }),
      goldToken.balanceOf(address),
      cUSD.balanceOf(address)
    ]);
    setSummary({
      ...summary,
      celo,
      cusd
    });
  }, [address, kit]);

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
   * 
   */
  async function addRole(inputAddress: string, role: number): Promise<void> {
    console.log(inputAddress);
    console.log(role);
    if (!inputAddress) {
      return;
    }
    const txObject = await hawalaContract.methods.addUser(inputAddress, role); 
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
  }

  /** 
   * 
   */
  async function mint() {
    console.log('mint');
  }

  /**
   * 
   */
  async function burn() {
    console.log('burn');
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

  function DonorView() {
    return (
      <div>
        <div>Welcome Donor</div>
        <div>Add the address of the Client</div>
        <div>
          <ContractButton disabled={transacting} onClick={() => wrapContractCall(() => addRole(inputAddress, 2))} children="Add" />
          <input className="bg-blue border-2 w-96" type="text" placeholder="Client Address" value={inputAddress} onChange={(event: any) => {
            setInputAddress(event.target.value);
          }}></input>
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
                <div>cUSD: {Web3.utils.fromWei(summary.cusd.toFixed())}</div>
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
