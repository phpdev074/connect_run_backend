import { ApiProperty } from '@nestjs/swagger';

export class HostUserDto {
    @ApiProperty({ example: '653bdf12903abc789e01' })
    _id: string;

    @ApiProperty({ example: 'John' })
    first_name: string;

    @ApiProperty({ example: 'Doe' })
    last_name: string;

    @ApiProperty({ example: 'RunnerJohn' })
    display_name: string;

    @ApiProperty({ example: 'https://avatar-url.com/johndoe.jpg', required: false })
    image?: string;

    @ApiProperty({ example: ['http://85.31.234.205:3030/uploads/file-1779878568414-972418455.jpeg'], required: false })
    profile_galary?: string[];

    @ApiProperty({ example: 'male', required: false })
    gender?: string;

    @ApiProperty({ example: 'intermediate', required: false })
    running_level?: string;
}

export class MatchesLiveRoomDto {
    @ApiProperty({ example: 'room_abc' })
    channelName: string;

    @ApiProperty({ example: '2026-05-29T10:15:30.000Z' })
    startTime: Date;

    @ApiProperty({ example: 12 })
    viewerCount: number;

    @ApiProperty({ example: 1 })
    coHostCount: number;

    @ApiProperty({ example: ['653bdf12903abc789e02'] })
    coHostIds: string[];

    @ApiProperty({ type: HostUserDto })
    host: HostUserDto;
}

export class MatchesLiveResponseDto {
    @ApiProperty({ example: 200 })
    statusCode: number;

    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Active live streams of matches fetched successfully' })
    message: string;

    @ApiProperty({ type: [MatchesLiveRoomDto] })
    data: MatchesLiveRoomDto[];
}
