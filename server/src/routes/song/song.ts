import express from 'express';
import { JwtPayload, verify } from 'jsonwebtoken';
import { groupBy, map, mergeAll, pluck, prop } from 'ramda';
import { Song } from '../../../../shared/types';
import { normalize } from '../../helpers/normalize';
import config from '../../lib/config';
import { getArtistSongs, getSong, search } from '../../lib/external/song';
import { ids } from '../../lib/utils';
import auth from '../../middlewares/auth';
import { HeartModel, CommentModel } from '../../model';

const router = express.Router();

router.get('/id/:id', async (req, res) => {
  try {
    const value = await getSong(req.params);

    const hearts = await HeartModel.find({ songId: req.params.id }).exec();
    const comments = await CommentModel.find({
      songId: req.params.id,
    }).exec();

    const song = normalize([
      'id',
      'title',
      'full_title',
      'song_art_image_url',
      'release_date_for_display',
      'primary_artist',
    ])(value.response.song);

    res.json(mergeAll([song, { hearts }, { comments }]));
  } catch (error) {}
});

router.get('/artist-songs/:id', async (req, res) => {
  try {
    const value = await getArtistSongs({
      ...req.body,
      artistId: req.params.id,
    });

    const songIds = ids(value.response.songs);

    let decoded;
    if (req.cookies['x-access-token']) {
      decoded = verify(req.cookies['x-access-token'], config.SECRET_KEY);
    }

    const hearts = await HeartModel.find({
      songId: {
        $in: [...songIds],
      },
      userId: {
        $ne: (decoded as JwtPayload)?.userId,
      },
    });

    const groupedHearts = groupBy(prop('songId'), hearts);

    const comments = await CommentModel.find({
      songId: {
        $in: [...songIds],
      },
    });

    const groupedComments = groupBy(prop('songId') as any, comments);

    const normalizeSongs = map(
      normalize([
        'id',
        'title',
        'full_title',
        'song_art_image_url',
        'release_date_for_display',
        'primary_artist',
      ])
    )(value.response.songs) as Song[];

    const songsWithAddition = map((song: Song) => ({
      ...song,
      hearts: groupedHearts[song.id] || [],
      comments: groupedComments[song.id] || [],
    }));

    res.json(songsWithAddition(normalizeSongs));
  } catch (error) {
    res.json(error);
  }
});

router.get('/hearts/:id', async (req, res) => {
  try {
    const hearts = await HeartModel.find({
      songId: req.params.id,
    });
    res.json(hearts);
  } catch (error) {
    res.json(error);
  }
});

router.post('/search', async (req, res) => {
  try {
    const value = await search(req.body);
    const result = pluck('result')(value.response.hits);
    const normalizeSongs = map(
      normalize(['id', 'title', 'song_art_image_url', 'primary_artist'])
    )(result) as Song[];
    res.json(normalizeSongs);
  } catch (error) {
    res.json(error);
  }
});

router.post('/like', auth, async (req, res) => {
  try {
    const { userId, songId } = req.body;
    let heart = await HeartModel.findOne({
      userId,
      songId,
    });
    if (heart) return res.json({ error: 'Already liked.' });
    heart = new HeartModel({
      userId,
      songId,
    });
    await heart.save();
    res.json(heart);
  } catch (error) {
    res.json(error);
  }
});

router.post('/unlike', auth, async (req, res) => {
  try {
    const { userId, songId } = req.body;
    let heart = await HeartModel.findOneAndDelete({
      userId,
      songId,
    });
    res.json(heart);
  } catch (error) {
    res.json(error);
  }
});

export default router;
