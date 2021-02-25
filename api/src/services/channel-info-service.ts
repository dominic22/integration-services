import { ChannelInfoPersistence, ChannelInfoSearch } from '../models/data/channel-info';
import * as ChannelInfoDb from '../database/channel-info';
import { DeleteWriteOpResultObject, InsertOneWriteOpResult, UpdateWriteOpResult, WithId } from 'mongodb';
import { UserService } from './user-service';

export class ChannelInfoService {
  private readonly userService: UserService;
  constructor(userService: UserService) {
    this.userService = userService;
  }

  getChannelInfo = async (channelAddress: string): Promise<ChannelInfoPersistence> => {
    return ChannelInfoDb.getChannelInfo(channelAddress);
  };

  searchChannelInfo = async (channelInfoSearch: ChannelInfoSearch): Promise<ChannelInfoPersistence[]> => {
    if (channelInfoSearch.author && !channelInfoSearch.authorId) {
      const authorId = (await this.userService.getUser(channelInfoSearch.author))?.userId;

      if (!authorId) {
        console.error(`No user id found for: ${channelInfoSearch.author}`);
      }
      const c = {
        ...channelInfoSearch,
        authorId
      };
      return ChannelInfoDb.searchChannelInfo(c);
    }
    return ChannelInfoDb.searchChannelInfo(channelInfoSearch);
  };

  addChannelInfo = async (channelInfo: ChannelInfoPersistence): Promise<InsertOneWriteOpResult<WithId<unknown>>> => {
    return ChannelInfoDb.addChannelInfo(channelInfo);
  };

  updateChannelInfo = async (channelInfo: ChannelInfoPersistence): Promise<UpdateWriteOpResult> => {
    return ChannelInfoDb.updateChannelInfo(channelInfo);
  };

  deleteChannelInfo = async (channelAddress: string): Promise<DeleteWriteOpResultObject> => {
    return ChannelInfoDb.deleteChannelInfo(channelAddress);
  };
}
