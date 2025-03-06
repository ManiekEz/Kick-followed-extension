export default async function apiCall(call, bearer) {
    let response;
    try {
      if (!bearer) {
        response = await fetch(call);
      } else {
        response = await fetch(call, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${bearer}`
          }
        });
      }
      try {
        return await response.json(); 
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError);
        return null;
      }
    } catch (error) {
      if(error.message === "Failed to fetch") {
        console.log(`Error fetching data: Too many requests.`); // mot sure how to handle this error.
        return null;
      }
      console.error(`Error fetching data (${call}):` , error);
      return null;
    }
  }
