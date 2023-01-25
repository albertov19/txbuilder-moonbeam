import React, { useState } from 'react';
import { Container, Menu, Dropdown, Input, Button, Label, Form, Message } from 'semantic-ui-react';
import Head from 'next/head';
import { subProvider } from '../web3/api';
import * as ethers from 'ethers';
import { Link } from '../routes';

const Networks = [
  {
    key: 'Moonbeam',
    text: 'Moonbeam',
    value: 'moonbeam',
    image: { avatar: true, src: 'moonbeam.png' },
    token: 'GLMR',
  },
  {
    key: 'Moonriver',
    text: 'Moonriver',
    value: 'moonriver',
    image: { avatar: true, src: 'moonriver.png' },
    token: 'MOVR',
  },
  {
    key: 'Moonbase Alpha',
    text: 'Moonbase Alpha',
    value: 'moonbase',
    image: { avatar: true, src: 'moonbase.png' },
    token: 'DEV',
  },
];

const GetStakingInfo = () => {
  const [network, setNetwork] = useState('moonbeam');
  const [stkAddress, setStkAddress] = useState();
  const [colAddress, setColAddress] = useState();
  const [amount, setAmount] = useState();
  const [autoCompound, setAutoCompound] = useState();
  const [stakingCall, setStakingCall] = useState({
    targetNetwork: '',
    stkAddress: '',
    colAddress: '',
    amount: 0,
    autoCompound: 0,
    candidateDelegationCount: 0,
    candidateAutoCompoundingDelegationCount: 0,
    delegationCount: 0,
    tokenLabel: '',
  });

  const [stakingCallData, setStakingCallData] = useState('');
  const [proxyCallData, setProxyCallData] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [tokenLabel, setTokenLabel] = useState('GLMR');

  const handleChange = (e, { value }) => {
    setNetwork(value);
    setTokenLabel(Networks.find((network) => network.value === value).token);
  };

  const calculate = async () => {
    setErrorMessage('');

    // Load Provider
    const api = await subProvider(network);
    setTokenLabel(Networks.find((data) => data.value === network).token);

    //Check Input
    // Staking Address
    let check = ethers.utils.isAddress(stkAddress);
    if (!check) {
      setErrorMessage('Address with funds not valid!');
      return;
    }

    // Collator Address
    check = ethers.utils.isAddress(colAddress);
    if (!check) {
      setErrorMessage('Collator address not valid!');
      return;
    }

    // Balance
    let balance = (await api.query.system.account(stkAddress)).toHuman().data;
    console.log(balance);
    check =
      BigInt(balance.free.replaceAll(',', '')) -
        BigInt(balance.miscFrozen.replaceAll(',', '')) -
        BigInt(100000000000000000) >
      BigInt(amount);
    if (!check) {
      setErrorMessage('Not enough balance!');
      return;
    }

    // AutoCompound Value between 0-100
    check = autoCompound >= 0 ? (autoCompound <= 100 ? true : false) : false;
    if (!check) {
      setErrorMessage('AutoCompound must be between 0 and 100!');
      return;
    }

    // Check if Candidate is Collator
    const candidatePool = (await api.query.parachainStaking.candidatePool()).toHuman();
    let isCandidate;
    candidatePool.map((candidate) => {
      if (colAddress === candidate.owner) {
        isCandidate = true;
      }
    });

    // Get Candidate Delegation Count
    let candidateDelegationCount;
    if (isCandidate) {
      candidateDelegationCount = BigInt(
        (await api.query.parachainStaking.candidateInfo(colAddress)).toHuman().delegationCount
      );
    } else {
      setErrorMessage('Collator is not a candidate in this network!');
      return;
    }

    // Get Candidate Auto-Compounding Delegation Count
    const candidateAutoCompoundingDelegationCount = BigInt(
      (await api.query.parachainStaking.autoCompoundingDelegations(colAddress)).toHuman().length
    );

    // Get Your Delegations Count
    let delegationCount;
    const delegatorInfo = await api.query.parachainStaking.delegatorState(stkAddress);

    if (delegatorInfo.toHuman()) {
      delegationCount = BigInt(delegatorInfo.toHuman()['delegations'].length);
    } else {
      delegationCount = 0n;
    }

    // Create Staking Call
    const stakingCall = await api.tx.parachainStaking.delegateWithAutoCompound(
      colAddress,
      amount,
      autoCompound,
      candidateDelegationCount + 10n,
      candidateAutoCompoundingDelegationCount + 10n,
      delegationCount + 10n
    );

    setStakingCallData(stakingCall.method.toHex());

    // Generate Proxy call
    const proxyCall = await api.tx.proxy.proxy(stkAddress, null, stakingCall);

    setProxyCallData(proxyCall.method.toHex());

    // Set Calculated Data
    setStakingCall({
      network: Networks.find((data) => data.value === network).key,
      colAddress,
      stkAddress,
      amount,
      autoCompound,
      candidateDelegationCount,
      candidateAutoCompoundingDelegationCount,
      delegationCount,
      tokenLabel,
    });
  };

  const checkAddress = (account) => {
    if (ethers.utils.isAddress(account)) {
      return ethers.utils.getAddress(account);
    } else {
      return account;
    }
  };

  return (
    <Container>
      <Head>
        <title>Transaction Builder</title>
        <link rel='icon' type='image/png' sizes='32x32' href='/favicon.png' />
        <link rel='stylesheet' href='//cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.css' />
      </Head>
      <div style={{ paddingTop: '10px' }}>
        <Menu>
          <Link route='/'>
            <a className='item'>Transaction Builder</a>
          </Link>
          <Menu.Item position='right'>
            <Dropdown
              placeholder='Select Network'
              selection
              options={Networks}
              onChange={handleChange}
              defaultValue={Networks[0].value}
            />
          </Menu.Item>
        </Menu>
      </div>
      <div style={{ width: '50%' }}>
        <h3>Staking Transaction</h3>
        <p>
          <Input
            fluid
            label={{ content: 'Account with Funds:' }}
            placeholder='Address with the tokens...'
            onChange={(input) => {
              let address = checkAddress(input.target.value);
              setStkAddress(address);
            }}
          />
        </p>
        <p>
          <Input
            fluid
            label={{ content: 'Enter Collator Address:' }}
            placeholder='Collator you want to stake...'
            onChange={(input) => {
              let address = checkAddress(input.target.value);
              setColAddress(address);
            }}
          />
        </p>
        <p>
          <Input
            fluid
            labelPosition='right'
            type='text'
            placeholder='Amount of tokens...'
            onChange={(input) => {
              let amount;
              if (input.target.value) {
                amount = ethers.utils.parseEther(input.target.value.toString()).toString();
              }
              setAmount(amount);
            }}
          >
            <Label>Enter Staking Amount:</Label>
            <input />
            <Label>{tokenLabel}</Label>
          </Input>
        </p>
        <p>
          <Input
            fluid
            labelPosition='right'
            type='text'
            placeholder='AutoCompound percentage...'
            onChange={(input) => setAutoCompound(Math.round(input.target.value))}
          >
            <Label>Enter AutoCompound Percent:</Label>
            <input />
            <Label>%</Label>
          </Input>
        </p>
      </div>
      <br />
      <Form onSubmit={() => calculate()} error={!!errorMessage}>
        <Button type='submit' disabled={!stkAddress || !colAddress || !amount || !autoCompound} color='orange'>
          Calculate Data
        </Button>
        <Message style={{ width: '50%' }} error header='Oops!' content={errorMessage} />
      </Form>
      <br />
      {stakingCallData && proxyCallData ? (
        <p>
          Staking Call URL:{' '}
          <a
            href={
              'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fmoonbeam.unitedbloc.com%3A3001#/extrinsics/decode/' +
              stakingCallData
            }
            target='_blank'
          >
            {' '}
            Staking Polkadot.js Apps Moonbeam URL
          </a>
          <br />
          Proxy Call URL:{' '}
          <a
            href={
              'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fmoonbeam.unitedbloc.com%3A3001#/extrinsics/decode/' +
              proxyCallData
            }
            target='_blank'
          >
            {' '}
            Proxy Polkadot.js Apps Moonbeam URL
          </a>
          <br />
          <ul>
            <li>{stakingCall.network}</li>
            <li>Account with Funds: {stakingCall.stkAddress}</li>
            <li>Collator: {stakingCall.colAddress} </li>
            <li>
              Staking Amount: {ethers.utils.formatEther(stakingCall.amount)} {stakingCall.tokenLabel}
            </li>
            <li>Auto-Compound: {stakingCall.autoCompound}</li>
            <li>Candidate Delegation Count: {stakingCall.candidateDelegationCount.toString()}</li>
            <li>
              Candidate AutoCompound Delegation Count: {stakingCall.candidateAutoCompoundingDelegationCount.toString()}
            </li>
            <li>Delegation Count: {stakingCall.delegationCount.toString()}</li>
          </ul>
        </p>
      ) : (
        ''
      )}

      <p>
        Don't judge the code :) as it is for demostration purposes only. You can check the source code{' '}
        <a href='https://github.com/albertov19/GetStakingInfo-Moonbeam' target='_blank'>
          here
        </a>
      </p>
    </Container>
  );
};

export default GetStakingInfo;
