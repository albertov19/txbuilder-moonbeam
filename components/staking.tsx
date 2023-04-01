import React, { useState, useEffect } from 'react';
import { Container, Input, Button, Label, Form, Message, Checkbox, GridColumn, Grid } from 'semantic-ui-react';
import { subProvider } from '../web3/api';
import * as ethers from 'ethers';

const StakingBuilder = ({ network }) => {
  const polkadotJsApps = 'https://polkadot.js.org/apps/?rpc=';
  const [stkOption, setStkOption] = useState('stake');
  const [stkAddress, setStkAddress] = useState('');
  const [colAddress, setColAddress] = useState('');
  const [amount, setAmount] = useState(BigInt(0));
  const [autoCompound, setAutoCompound] = useState(BigInt(0));
  const [stakingCall, setStakingCall] = useState({
    targetNetwork: '',
    stkOption: '',
    stkAddress: '',
    colAddress: '',
    amount: BigInt(0),
    autoCompound: BigInt(0),
    candidateDelegationCount: BigInt(0),
    candidateAutoCompoundingDelegationCount: BigInt(0),
    delegationCount: BigInt(0),
    tokenLabel: '',
  });

  const [stakingCallData, setStakingCallData] = useState('');
  const [proxyCallData, setProxyCallData] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [tokenLabel, setTokenLabel] = useState(network.token);
  const [URL, setURL] = useState(network.url);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTokenLabel(network.token);
  }, [network]);

  const calculate = async () => {
    setLoading(true);
    setErrorMessage('');

    // Load Provider
    const api = await subProvider(network.url);
    setTokenLabel(network.token);
    setURL(network.url);

    if (stkOption == 'stake') {
      await calculateStake(api);
    } else if (stkOption == 'increase') {
      await calculateIncrease(api);
    } else if (stkOption == 'decrease') {
      await calculateDecrease(api);
    } else if (stkOption == 'revoke') {
      await calculateRevoke(api);
    } else if (stkOption == 'execute') {
      await calculateExecute(api);
    } else if (stkOption == 'cancel') {
      await calculateCancel(api);
    }
    setLoading(false);
  };

  const calculateStake = async (api) => {
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
    let balance = ((await api.query.system.account(stkAddress)) as any).toHuman().data;
    check =
      BigInt(balance.free.replaceAll(',', '')) -
        BigInt(balance.feeFrozen.replaceAll(',', '')) -
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
    const candidatePool = ((await api.query.parachainStaking.candidatePool()) as any).toHuman();
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
        ((await api.query.parachainStaking.candidateInfo(colAddress)) as any).toHuman().delegationCount
      );
    } else {
      setErrorMessage('Collator is not a candidate in this network!');
      return;
    }

    // Get Candidate Auto-Compounding Delegation Count
    const candidateAutoCompoundingDelegationCount = BigInt(
      ((await api.query.parachainStaking.autoCompoundingDelegations(colAddress)) as any).toHuman().length
    );

    // Get Your Delegations Count
    let delegationCount;
    const delegatorInfo = ((await api.query.parachainStaking.delegatorState(stkAddress)) as any).toHuman();

    if (delegatorInfo) {
      delegationCount = BigInt(delegatorInfo['delegations'].length);

      // Ensure Candidate is not Being Delegated
      delegatorInfo.delegations.map((delegation) => {
        console.log(delegation);

        if (delegation.owner == colAddress) {
          setErrorMessage('You are already staking to this collator, use INCREASE instead!');
          return;
        }
      });
    } else {
      delegationCount = BigInt(0);
    }

    // Create Staking Call
    const stakingCall = await api.tx.parachainStaking.delegateWithAutoCompound(
      colAddress,
      amount,
      autoCompound,
      candidateDelegationCount + BigInt(10),
      candidateAutoCompoundingDelegationCount + BigInt(10),
      delegationCount + BigInt(10)
    );

    setStakingCallData(stakingCall.method.toHex());

    // Generate Proxy call
    const proxyCall = await api.tx.proxy.proxy(stkAddress, null, stakingCall);

    setProxyCallData(proxyCall.method.toHex());

    // Set Calculated Data
    setStakingCall({
      targetNetwork: network.key,
      stkOption,
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

  const calculateIncrease = async (api) => {
    let autoCompound = BigInt(0);
    let candidateDelegationCount = BigInt(0);
    let candidateAutoCompoundingDelegationCount = BigInt(0);
    let delegationCount = BigInt(0);

    // Staking Address
    let check = ethers.utils.isAddress(stkAddress);
    if (!check) {
      setErrorMessage('Address with funds not valid!');
      return;
    }

    //Check Input
    // Collator Address
    check = ethers.utils.isAddress(colAddress);
    if (!check) {
      setErrorMessage('Collator address not valid!');
      return;
    }

    // Balance
    let balance = ((await api.query.system.account(stkAddress)) as any).toHuman().data;
    check =
      BigInt(balance.free.replaceAll(',', '')) -
        BigInt(balance.feeFrozen.replaceAll(',', '')) -
        BigInt(100000000000000000) >
      BigInt(amount);
    if (!check) {
      setErrorMessage('Not enough balance!');
      return;
    }

    // Check if you are Staking to that collator
    const candidatesStaked = ((await api.query.parachainStaking.delegatorState(stkAddress)) as any).toHuman();
    let isStaked;
    candidatesStaked.delegations.map((candidate) => {
      if (colAddress === candidate.owner) {
        isStaked = true;
      }
    });
    if (!isStaked) {
      setErrorMessage("You can't increase to a collator you are not staking!");
      return;
    }

    // Create Staking Call
    const stakingCall = await api.tx.parachainStaking.delegatorBondMore(colAddress, amount);

    setStakingCallData(stakingCall.method.toHex());

    // Generate Proxy call
    const proxyCall = await api.tx.proxy.proxy(stkAddress, null, stakingCall);

    setProxyCallData(proxyCall.method.toHex());

    // Set Calculated Data
    setStakingCall({
      targetNetwork: network.key,
      stkOption,
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

  const calculateDecrease = async (api) => {
    let autoCompound = BigInt(0);
    let candidateDelegationCount = BigInt(0);
    let candidateAutoCompoundingDelegationCount = BigInt(0);
    let delegationCount = BigInt(0);

    // Staking Address
    let check = ethers.utils.isAddress(stkAddress);
    if (!check) {
      setErrorMessage('Address with funds not valid!');
      return;
    }

    //Check Input
    // Collator Address
    check = ethers.utils.isAddress(colAddress);
    if (!check) {
      setErrorMessage('Collator address not valid!');
      return;
    }

    // Check if you are Staking to that collator
    const candidatesStaked = ((await api.query.parachainStaking.delegatorState(stkAddress)) as any).toHuman();
    let isStaked;
    let balance;
    candidatesStaked.delegations.map((candidate) => {
      if (colAddress === candidate.owner) {
        isStaked = true;
        balance = BigInt(candidate.amount.replaceAll(',', ''));
      }
    });

    // Staking related errors
    if (!isStaked) {
      setErrorMessage("You can't decrease to a collator you are not staking!");
      return;
    }

    // Balance
    check = balance > BigInt(amount);
    if (!check) {
      setErrorMessage('You are decreasing more than what you have staked!');
      return;
    }

    // Create Staking Call
    const stakingCall = await api.tx.parachainStaking.scheduleDelegatorBondLess(colAddress, amount);

    setStakingCallData(stakingCall.method.toHex());

    // Generate Proxy call
    const proxyCall = await api.tx.proxy.proxy(stkAddress, null, stakingCall);

    setProxyCallData(proxyCall.method.toHex());

    // Set Calculated Data
    setStakingCall({
      targetNetwork: network.key,
      stkOption,
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

  const calculateRevoke = async (api) => {
    let autoCompound = BigInt(0);
    let candidateDelegationCount = BigInt(0);
    let candidateAutoCompoundingDelegationCount = BigInt(0);
    let delegationCount = BigInt(0);
    let amount = BigInt(0);

    // Staking Address
    let check = ethers.utils.isAddress(stkAddress);
    if (!check) {
      setErrorMessage('Address with funds not valid!');
      return;
    }

    //Check Input
    // Collator Address
    check = ethers.utils.isAddress(colAddress);
    if (!check) {
      setErrorMessage('Collator address not valid!');
      return;
    }

    // Check if you are Staking to that collator
    const candidatesStaked = ((await api.query.parachainStaking.delegatorState(stkAddress)) as any).toHuman();
    let isStaked;
    candidatesStaked.delegations.map((candidate) => {
      if (colAddress === candidate.owner) {
        isStaked = true;
      }
    });
    if (!isStaked) {
      setErrorMessage("You can't revoke a collator you are not staking!");
      return;
    }

    // Create Staking Call
    const stakingCall = await api.tx.parachainStaking.scheduleRevokeDelegation(colAddress);

    setStakingCallData(stakingCall.method.toHex());

    // Generate Proxy call
    const proxyCall = await api.tx.proxy.proxy(stkAddress, null, stakingCall);

    setProxyCallData(proxyCall.method.toHex());

    // Set Calculated Data
    setStakingCall({
      targetNetwork: network.key,
      stkOption,
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

  const calculateExecute = async (api) => {
    let autoCompound = BigInt(0);
    let candidateDelegationCount = BigInt(0);
    let candidateAutoCompoundingDelegationCount = BigInt(0);
    let delegationCount = BigInt(0);
    let amount = BigInt(0);

    // Staking Address
    let check = ethers.utils.isAddress(stkAddress);
    if (!check) {
      setErrorMessage('Address with funds not valid!');
      return;
    }

    //Check Input
    // Collator Address
    check = ethers.utils.isAddress(colAddress);
    if (!check) {
      setErrorMessage('Collator address not valid!');
      return;
    }

    // Check if you are Staking to that collator
    const candidatesStaked = ((await api.query.parachainStaking.delegatorState(stkAddress)) as any).toHuman();
    let isStaked;
    candidatesStaked.delegations.map((candidate) => {
      if (colAddress === candidate.owner) {
        isStaked = true;
      }
    });
    if (!isStaked) {
      setErrorMessage("You can't revoke a collator you are not staking!");
      return;
    }

    // Create Staking Call
    const stakingCall = await api.tx.parachainStaking.executeDelegationRequest(stkAddress, colAddress);

    setStakingCallData(stakingCall.method.toHex());

    // Generate Proxy call
    const proxyCall = await api.tx.proxy.proxy(stkAddress, null, stakingCall);

    setProxyCallData(proxyCall.method.toHex());

    // Set Calculated Data
    setStakingCall({
      targetNetwork: network.key,
      stkOption,
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

  const calculateCancel = async (api) => {
    let autoCompound = BigInt(0);
    let candidateDelegationCount = BigInt(0);
    let candidateAutoCompoundingDelegationCount = BigInt(0);
    let delegationCount = BigInt(0);
    let amount = BigInt(0);

    // Staking Address
    let check = ethers.utils.isAddress(stkAddress);
    if (!check) {
      setErrorMessage('Address with funds not valid!');
      return;
    }

    //Check Input
    // Collator Address
    check = ethers.utils.isAddress(colAddress);
    if (!check) {
      setErrorMessage('Collator address not valid!');
      return;
    }

    // Check if you have a Schedule Request Against that Collator
    const scheduledRequests = (
      (await api.query.parachainStaking.delegationScheduledRequests(colAddress)) as any
    ).toHuman();
    console.log(scheduledRequests);
    let isRequest;
    scheduledRequests.map((request) => {
      if (stkAddress == request.delegator) {
        isRequest = true;
      }
    });
    if (!isRequest) {
      setErrorMessage('There is not request from this address to the specified collator!');
      return;
    }

    // Create Staking Call
    const stakingCall = await api.tx.parachainStaking.cancelDelegationRequest(colAddress);

    setStakingCallData(stakingCall.method.toHex());

    // Generate Proxy call
    const proxyCall = await api.tx.proxy.proxy(stkAddress, null, stakingCall);

    setProxyCallData(proxyCall.method.toHex());

    // Set Calculated Data
    setStakingCall({
      targetNetwork: network.key,
      stkOption,
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

  const stakingForm = () => {
    return (
      <div className='stakingInput'>
        <Input
          fluid
          label={{ content: 'Account with Funds:' }}
          placeholder='Address with the tokens...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setStkAddress(address);
          }}
        />
        <br />
        <Input
          fluid
          label={{ content: 'Enter Collator Address:' }}
          placeholder='Collator you want to stake...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setColAddress(address);
          }}
        />
        <br />

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
        <br />

        <Input
          fluid
          labelPosition='right'
          type='text'
          placeholder='AutoCompound percentage...'
          onChange={(input) => setAutoCompound(BigInt(Math.round(Number(input.target.value))))}
        >
          <Label>Enter AutoCompound Percent:</Label>
          <input />
          <Label>%</Label>
        </Input>
      </div>
    );
  };

  const increaseForm = () => {
    return (
      <div className='increaseInput'>
        <Input
          fluid
          label={{ content: 'Account with Funds:' }}
          placeholder='Address with the tokens...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setStkAddress(address);
          }}
        />
        <br />
        <Input
          fluid
          label={{ content: 'Enter Collator Address:' }}
          placeholder='Collator you want increase stake...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setColAddress(address);
          }}
        />
        <br />

        <Input
          fluid
          labelPosition='right'
          type='text'
          placeholder='Amount of tokens to increase...'
          onChange={(input) => {
            let amount;
            if (input.target.value) {
              amount = ethers.utils.parseEther(input.target.value.toString()).toString();
            }
            setAmount(amount);
          }}
        >
          <Label>Enter Increase Amount:</Label>
          <input />
          <Label>{tokenLabel}</Label>
        </Input>
        <br />
      </div>
    );
  };

  const decreaseForm = () => {
    return (
      <div className='decreaseInput'>
        <Input
          fluid
          label={{ content: 'Account with Funds:' }}
          placeholder='Address with the tokens...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setStkAddress(address);
          }}
        />
        <br />
        <Input
          fluid
          label={{ content: 'Enter Collator Address:' }}
          placeholder='Collator you want to decrease stake...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setColAddress(address);
          }}
        />
        <br />

        <Input
          fluid
          labelPosition='right'
          type='text'
          placeholder='Amount of tokens to decrease...'
          onChange={(input) => {
            let amount;
            if (input.target.value) {
              amount = ethers.utils.parseEther(input.target.value.toString()).toString();
            }
            setAmount(amount);
          }}
        >
          <Label>Enter Decrease Amount:</Label>
          <input />
          <Label>{tokenLabel}</Label>
        </Input>
        <br />
      </div>
    );
  };

  const revokeForm = () => {
    return (
      <div className='revokeInput'>
        <Input
          fluid
          label={{ content: 'Account with Funds:' }}
          placeholder='Address with the tokens...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setStkAddress(address);
          }}
        />
        <br />
        <Input
          fluid
          label={{ content: 'Enter Collator Address:' }}
          placeholder='Collator you want to revoke stake...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setColAddress(address);
          }}
        />
        <br />
      </div>
    );
  };

  const executeForm = () => {
    return (
      <div className='executeInput'>
        <Input
          fluid
          label={{ content: 'Account with Funds:' }}
          placeholder='Address with the tokens...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setStkAddress(address);
          }}
        />
        <br />
        <Input
          fluid
          label={{ content: 'Enter Collator Address:' }}
          placeholder='Collator you want to execute request from...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setColAddress(address);
          }}
        />
        <br />
      </div>
    );
  };

  const cancelForm = () => {
    return (
      <div className='executeInput'>
        <Input
          fluid
          label={{ content: 'Account with Funds:' }}
          placeholder='Address with the tokens...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setStkAddress(address);
          }}
        />
        <br />
        <Input
          fluid
          label={{ content: 'Enter Collator Address:' }}
          placeholder='Collator you want to execute request from...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setColAddress(address);
          }}
        />
        <br />
      </div>
    );
  };

  return (
    <Container>
      <div style={{ width: '50%' }}>
        <h3>Staking Transaction</h3>
        <Form>
          <Grid columns={6}>
            <GridColumn>
              <Form.Field>
                <Checkbox
                  radio
                  label='Stake'
                  name='checkboxRadioGroup'
                  value='stake'
                  checked={stkOption === 'stake'}
                  onChange={(e, data) => {
                    setStkOption(String(data.value));
                  }}
                />
              </Form.Field>
            </GridColumn>
            <GridColumn>
              <Form.Field>
                <Checkbox
                  radio
                  label='Increase'
                  name='checkboxRadioGroup'
                  value='increase'
                  checked={stkOption === 'increase'}
                  onChange={(e, data) => {
                    setStkOption(String(data.value));
                    setAutoCompound(BigInt(0));
                  }}
                />
              </Form.Field>
            </GridColumn>
            <GridColumn>
              <Form.Field>
                <Checkbox
                  radio
                  label='Decrease'
                  name='checkboxRadioGroup'
                  value='decrease'
                  checked={stkOption === 'decrease'}
                  onChange={(e, data) => setStkOption(String(data.value))}
                />
              </Form.Field>
            </GridColumn>
            <GridColumn>
              <Form.Field>
                <Checkbox
                  radio
                  label='Revoke'
                  name='checkboxRadioGroup'
                  value='revoke'
                  checked={stkOption === 'revoke'}
                  onChange={(e, data) => setStkOption(String(data.value))}
                />
              </Form.Field>
            </GridColumn>
            <GridColumn>
              <Form.Field>
                <Checkbox
                  radio
                  label='Execute'
                  name='checkboxRadioGroup'
                  value='execute'
                  checked={stkOption === 'execute'}
                  onChange={(e, data) => setStkOption(String(data.value))}
                />
              </Form.Field>
            </GridColumn>
            <GridColumn>
              <Form.Field>
                <Checkbox
                  radio
                  label='Cancel'
                  name='checkboxRadioGroup'
                  value='cancel'
                  checked={stkOption === 'cancel'}
                  onChange={(e, data) => setStkOption(String(data.value))}
                />
              </Form.Field>
            </GridColumn>
          </Grid>
        </Form>
        <br />
        {stkOption == 'stake'
          ? stakingForm()
          : stkOption == 'increase'
          ? increaseForm()
          : stkOption == 'decrease'
          ? decreaseForm()
          : stkOption == 'revoke'
          ? revokeForm()
          : stkOption == 'execute'
          ? executeForm()
          : stkOption == 'cancel'
          ? cancelForm()
          : ''}
      </div>
      <br />
      <Form onSubmit={() => calculate()} error={!!errorMessage}>
        <Button type='submit' color='orange' loading={loading}>
          Calculate Data
        </Button>
        <Message style={{ width: '50%' }} error header='Oops!' content={errorMessage} />
      </Form>
      <br />
      {stakingCallData && proxyCallData ? (
        <div>
          Staking Call URL:{' '}
          <a href={polkadotJsApps + URL + '#/extrinsics/decode/' + stakingCallData} target='_blank'>
            {' '}
            Staking Polkadot.js Apps Moonbeam URL
          </a>
          <br />
          Proxy Call URL:{' '}
          <a href={polkadotJsApps + URL + '#/extrinsics/decode/' + proxyCallData} target='_blank'>
            {' '}
            Proxy Polkadot.js Apps Moonbeam URL
          </a>
          <br />
          <ul>
            <li>{stakingCall.targetNetwork}</li>
            <li>Staking Action: {stakingCall.stkOption.toUpperCase()}</li>
            <li>Account with Funds: {stakingCall.stkAddress}</li>
            <li>Collator: {stakingCall.colAddress} </li>
            <li>
              Staking Amount: {ethers.utils.formatEther(stakingCall.amount)} {stakingCall.tokenLabel}
            </li>
            <li> Auto-Compound: {stakingCall.autoCompound.toString()} </li>
            <li>Candidate Delegation Count: {stakingCall.candidateDelegationCount.toString()}</li>
            <li>
              Candidate AutoCompound Delegation Count: {stakingCall.candidateAutoCompoundingDelegationCount.toString()}
            </li>
            <li>Delegation Count: {stakingCall.delegationCount.toString()}</li>
          </ul>
        </div>
      ) : (
        ''
      )}
    </Container>
  );
};

export default StakingBuilder;
