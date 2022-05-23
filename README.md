# The Wall

This is the full source of [The Wall](https://testnet.grafiklabs.nyc/), an experimental NFT-based crowd-sourced art platform.

## Contracts

The "backend" of the project is a set of NFT smart contracts, which is what the root repository hosts. Everything except `frontend/` is components of a hardhat project to develop, test, deploy and maintain the smart contracts necessary to create the individual "**Tiles**" and "**Patches**" the platform is build on (check About below for more info).

## Frontend

The web3 frontend for the project is in the submodule `frontend/`. This is setup as a monorepo to allow access from the frontend to the deployed contract addresses and abis, which live under `deployments/` in this repo. It is written in basic Next.js/React (not using Redux, to the author's pain and regret).

## Demo / Design

The product is live on a testnet at https://testnet.grafiklabs.nyc/

If you do not have Metamask installed and would not like to do so, you can see most intended functionality in the publicly visible mocks at (use arrow keys to navigate mock): https://thewall.invisionapp.com/overview/The-Wall-cl1wtldb20l3p01995o6tfcz0/screens

# About

Read below for the intended publicly-visible about section (***Draft***).

## What is "The Wall"?

**The wall** is an experiment in crowd-sourced art. **The wall** will initially consist of 128x128 **tiles**, each of which is a unique NFT on the Ethereum network. **Tiles** will be sequentially minted in a clockwise spiral starting at the center. You are free to interact with our smart contracts in any way you'd like - although the website gives you a simple, friendly web3 interface to do so. Keep in mind, you must have MetaMask installed and setup/unlocked to use it.

Once all 16,384 **tiles** in Batch 1 have been minted, the canvas will increase to 192x192 after some delay. We like to keep things mysterious, so we won't say how much - but you won't have to wait long. Similarly, once all 20,480 additional **tiles** in Batch 2 have been minted, the canvas will grow for the second time to 256x256, releasing the final 28,672 **tiles**. This canvas will never grow past 256x256 - you have our word. And if you don't trust that (we get it) - check the contract!

## What do I receive when I mint a **tile**?

You get a **tile**. That's it. This isn't a pre-sale, there's nothing we promise to do in the future. We do have exciting plans but we would prefer to keep them to ourselves until they're ready. We kinda dislike the whole vaporware vibe going on in the NFT community. You should mint a **tile** if you consider it valuable in its current state.

## What can I do with my **tile**?

You own all of your **tiles**. Just like with any other NFT, you are free to resell, hoard and misplace them. You can always change the colors of your own **tiles**, without limitations. You can also set your entire wallet's reserve of **tiles** as editable by others. You will retain ownership, of course, but anyone can contribute to your "el artiste" corner.

As to what you choose to create with those colors... That's what we'd like to know as well!

If you happen to have a contiguous rectangular area of **tiles** at any point - you can also create a **patch** of those **tiles**. **Patches** can only be rectangular, and minting a **patch** will immediately revoke all your **tile** NFT in the selected area and instead mint a new **patch** NFT that is immediately transferred to you. Ownership of the **patch** will now control ownership of all **tiles** simultaneously. You can resell, hoard and misplace **patches**, just like you would with **tiles**!

## What can I do with my **patches**?

Just like with **tiles**, you own all of your **patches**. You can think of a **patch** as a "shortcut" for the ownership of all **tiles** in a rectangular area. Transferring a **patch** will transfer the ownership of all **tiles** simultaneously. Besides that, the same rules on coloring and locking/unlocking apply, just like with individual **tiles**.

If you have two **patches** next to each other of the same width or height, such that the combined area of the canvas is a rectangle, you can choose to combine them together into a single **patch**. The resulting **patch** will be managed as described already. Same rules apply on colors and locking.

Finally, if you decide at any point that you no longer want to keep **tiles** together in a **patch** - you can break the **patch** back up into the **tile** NFTs comprising it. You will immediately revoke the **patch** NFT and re-mint the original **tile** NFTs that you can then individually re-sale or otherwise manage.