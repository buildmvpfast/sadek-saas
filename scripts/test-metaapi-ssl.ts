
import https from 'https';

// FORCING SSL IGNORE FOR EXPIRED CERTIFICATE
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testMetaApiSSL() {
  const token = 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1Y2U4ZGIwMDFhMGIwNmE4YTA2MWQ2NjViNDA0ZmUwNiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiNWNlOGRiMDAxYTBiMDZhOGEwNjFkNjY1YjQwNGZlMDYiLCJpYXQiOjE3NjYxMzcxNDR9.mWREPqmGXBZCIdYtUZXI-Zscj80o9bH3o3OovkoMkkyMWXoY0amLEYAeUyhO1D6VYy0kQXEODf5iTXFE-k6MO2c7k_NxRgusL1rQ0sIPJyT5z1zB07hiri5SKXtvCpMOz4NBliOce7tUwd5rtLpIIDpzvEjWalzIm37Rkcr1oLRMGjXwfuRkqWIdhdWQAO6j3tgJHlc-zggztcJBm_sBiFaiIeklsh8nFhpy8GQSfhoSDX6GlhSyXdAseurpHw3U8Vw-KNaDTWVxetbtb1gnNf2sfnzf7H6PPcBOm6uxs3yYCiwFChA0lCsJ3vOBszTtLoVprPayg_wBsOeyVyZt8yUjCLfLjzNoAH-Bqvy3YA5EkpJy_qm8FIEbla-uLngHcKaYRy_gnGcXJwUGytfzL3YOeAW3xgVnIldb8S3tbtuWDyDlBBHIp_bru_wKraS_eHkgployS4JKI6m3Xxi3pknT66KQaGBTDu8pTsGRxOkZRXTA131bJSQ9mDLqtI1kP7FNq7WSsjmCxpMzrgjGtmcL52vzz3yYANqvSnzc5PSoimRjH-0VqtK6zFhKOl-c14RGMQdDYlMBFo6ERudO5WkEHgO0fs5ROtnFhGcsUii1J5iWHv2fNLYp-4pGXgybJ5HfcNBBxvdkQZvK370RzpnmD4R-UkQFH3X6C0dls9U';
  const url = 'https://mt-client-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts';

  console.log('🔍 Testing MetaApi connection with SSL ignore...');

  const agent = new https.Agent({
    rejectUnauthorized: false
  });

  try {
    const response = await fetch(url, {
      headers: { 'auth-token': token },
      // @ts-ignore - node-fetch or native fetch support agent in different ways
      agent: agent 
    });

    const text = await response.text();
    console.log(`📡 Status: ${response.status}`);
    console.log(`📄 Response: ${text.substring(0, 100)}...`);
    
    if (response.ok) {
        console.log('✅ Connection SUCCESSFUL with SSL ignore!');
    } else {
        console.log('❌ Connection failed but host was reached (Status != 200)');
    }
  } catch (error) {
    console.error('❌ Fetch failed:', error);
  }
}

testMetaApiSSL();
