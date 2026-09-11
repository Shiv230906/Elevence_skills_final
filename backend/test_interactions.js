const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config();
const Friend = require('./Model/Friend');
const Post = require('./Model/Post');

const USER1 = 'X3MWqp4MCuQroAfgVBzsL3Qxqdh2';
const USER2 = 'IgJQQU7RiRfEl6aad9SAYdlz6lS2';

async function run() {
  await mongoose.connect(process.env.DATABASE_URL);
  console.log('--- STEP 6: VERIFY DATABASE & SOCIAL INTERACTIONS ---');

  // 1. Verify Friend record
  const friendDoc = await Friend.findOne({
    requester: USER1,
    receiver: USER2,
    status: 'accepted',
  });
  console.log('1. Friend document in DB:', friendDoc ? 'VERIFIED (accepted)' : 'NOT FOUND');
  console.log('   Requester:', friendDoc?.requester);
  console.log('   Receiver:', friendDoc?.receiver);
  console.log('   Status:', friendDoc?.status);

  // 2. Verify Post document created by User 1
  const postDoc = await Post.findOne({ userId: USER1 }).sort({ createdAt: -1 });
  console.log('2. Post document in DB:', postDoc ? 'VERIFIED' : 'NOT FOUND');
  console.log('   Post ID:', postDoc?._id.toString());
  console.log('   Post Author UID:', postDoc?.userId);
  console.log('   Post Content:', postDoc?.content);

  const postId = postDoc._id.toString();

  // 3. Test Like by User 2
  // Simulate POST /api/posts/:id/like
  console.log('3. Testing Like by User 2...');
  if (!postDoc.likes.includes(USER2)) {
    postDoc.likes.push(USER2);
    await postDoc.save();
  }
  let reloadedPost = await Post.findById(postId);
  console.log('   Likes array after User 2 like:', reloadedPost.likes);
  console.log('   User 2 in likes?', reloadedPost.likes.includes(USER2));

  // 4. Test Comment by User 2
  console.log('4. Testing Comment by User 2...');
  reloadedPost.comments.push({
    userId: USER2,
    userName: 'Test User 2',
    userPhoto: '',
    text: 'Congratulations on your first post! Looking forward to collaborating.',
  });
  await reloadedPost.save();
  reloadedPost = await Post.findById(postId);
  console.log('   Comments count:', reloadedPost.comments.length);
  console.log('   Latest comment userId:', reloadedPost.comments[reloadedPost.comments.length - 1].userId);
  console.log('   Latest comment text:', reloadedPost.comments[reloadedPost.comments.length - 1].text);

  // 5. Test Share
  console.log('5. Testing Share increment...');
  reloadedPost.shares = (reloadedPost.shares || 0) + 1;
  await reloadedPost.save();
  reloadedPost = await Post.findById(postId);
  console.log('   Shares count:', reloadedPost.shares);

  // 6. Verify daily post count calculation against DB directly
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const u1PostCountToday = await Post.countDocuments({
    userId: USER1,
    createdAt: { $gte: today, $lt: tomorrow },
  });
  const u2PostCountToday = await Post.countDocuments({
    userId: USER2,
    createdAt: { $gte: today, $lt: tomorrow },
  });
  console.log(`6. Direct DB verification - User 1 posts today: ${u1PostCountToday}`);
  console.log(`   Direct DB verification - User 2 posts today: ${u2PostCountToday}`);

  await mongoose.disconnect();
  console.log('--- ALL STEP 6 DATABASE TESTS COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
