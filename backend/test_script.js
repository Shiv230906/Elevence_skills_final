const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config();
const Friend = require('./Model/Friend');
const Post = require('./Model/Post');
const { getDailyPostLimit } = require('./config/communityConfig');

const USER1 = 'X3MWqp4MCuQroAfgVBzsL3Qxqdh2';
const USER2 = 'IgJQQU7RiRfEl6aad9SAYdlz6lS2';

async function run() {
  await mongoose.connect(process.env.DATABASE_URL);
  console.log('MongoDB connected successfully');

  // Step 1: Check existing
  const existingBetween = await Friend.findOne({
    $or: [
      { requester: USER1, receiver: USER2 },
      { requester: USER2, receiver: USER1 },
    ],
  });

  console.log('Existing relationship between User1 and User2:', existingBetween);

  let friendship;
  if (!existingBetween) {
    friendship = new Friend({
      requester: USER1,
      receiver: USER2,
      status: 'accepted',
    });
    await friendship.save();
    console.log('Created new accepted friendship:', friendship);
  } else {
    if (existingBetween.status !== 'accepted') {
      existingBetween.status = 'accepted';
      await existingBetween.save();
      console.log('Updated existing relationship to accepted:', existingBetween);
    } else {
      console.log('Relationship already exists and is accepted:', existingBetween);
    }
    friendship = existingBetween;
  }

  // Step 2: Verify friend counts
  const u1Count = await Friend.countDocuments({
    $or: [{ requester: USER1 }, { receiver: USER1 }],
    status: 'accepted',
  });
  const u2Count = await Friend.countDocuments({
    $or: [{ requester: USER2 }, { receiver: USER2 }],
    status: 'accepted',
  });

  console.log(`Test User 1 friend count (status=accepted): ${u1Count}`);
  console.log(`Test User 2 friend count (status=accepted): ${u2Count}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
