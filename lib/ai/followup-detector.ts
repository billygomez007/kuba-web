export function shouldCreateFollowUp(
  message:string,
){

  const keywords = [
    "interested",
    "call me later",
    "follow up",
    "send me details",
    "i will decide",
    "contact me",
    "remind me",
  ];


  const text =
    message.toLowerCase();


  return keywords.some(
    (word)=>
      text.includes(word),
  );

}
