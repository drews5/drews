// Used only by the build rollback test in a separate Node process.
globalThis.fetch=async()=>{throw Error('Simulated spreadsheet outage');};
