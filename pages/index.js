import React, { useState } from 'react';
import { Container, Menu, Dropdown, Input, Button, Label, Form } from 'semantic-ui-react';
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
  },
  {
    key: 'Moonriver',
    text: 'Moonriver',
    value: 'moonriver',
    image: { avatar: true, src: 'moonriver.png' },
  },
  {
    key: 'Moonbase Alpha',
    text: 'Moonbase Alpha',
    value: 'moonbase',
    image: { avatar: true, src: 'moonbase.png' },
  },
];

const GetStakingInfo = () => {
  const [network, setNetwork] = useState('moonbeam');
  const [stkAddress, setStkAddress] = useState();
  const [colAddress, setColAddress] = useState();
  const [amount, setAmount] = useState();
  const [autoCompound, setAutoCompound] = useState();
  const [stakingCall, setStakingCall] = useState({
    stkAddress: '',
    colAddress: '',
    amount: 0,
    autoCompound: 0,
    candidateDelegationCount: 0,
    candidateAutoCompoundingDelegationCount: 0,
    delegationCount: 0,
  });

  const [stakingCallData, setStakingCallData] = useState('');
  const [proxyCallData, setProxyCallData] = useState('');

  const handleChange = (e, { value }) => {
    setNetwork(value);
  };

  const calculate = async () => {
    // Load Provider
    const api = await subProvider(network);

    // Get Candidate Delegation Count
    const candidateDelegationCount = BigInt(
      (await api.query.parachainStaking.candidateInfo(colAddress)).toHuman().delegationCount
    );

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
      colAddress,
      stkAddress,
      amount,
      autoCompound,
      candidateDelegationCount,
      candidateAutoCompoundingDelegationCount,
      delegationCount,
    });
  };

  const checkAddress = (account) => {
    return ethers.utils.getAddress(account);
  };

  return (
    <Container>
      <Head>
        <title>Transaction Builder</title>
        <link rel='icon' type='image/png' sizes='32x32' href='/favicon.png' />
        <link rel='stylesheet' href='//cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.css' />
      </Head>
      <div style={{ paddingTop: '10px' }}></div>
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
            <Label>GLMR</Label>
          </Input>
        </p>
        <p>
          <Input
            fluid
            labelPosition='right'
            type='text'
            placeholder='AutoCompound percentage...'
            onChange={(input) => setAutoCompound(input.target.value)}
          >
            <Label>Enter AutoCompound Percent:</Label>
            <input />
            <Label>%</Label>
          </Input>
        </p>
      </div>
      <br />
      <Form onSubmit={() => calculate()}>
        <Button type='submit' disabled={!stkAddress || !colAddress || !amount || !autoCompound} color='orange'>
          Calculate Data
        </Button>
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
            <li>Account with Funds: {stakingCall.stkAddress}</li>
            <li>Collator: {stakingCall.colAddress} </li>
            <li>Staking Amount: {ethers.utils.formatEther(stakingCall.amount)} GLMR</li>
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
