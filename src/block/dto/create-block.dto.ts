import { ApiProperty } from "@nestjs/swagger";
import { IsMongoId } from "class-validator";

export class CreateBlockDto {
  // @ApiProperty({
  //     description: 'User ID who is blocking',
  //     example: '64f1b2c8e4a1c9b8a1234567',
  // })
  // @IsMongoId()
  // blockerId: string;

  @ApiProperty({
    description: "User ID who is being blocked",
    example: "64f1b2c8e4a1c9b8a7654321",
  })
  @IsMongoId()
  blockedId: string;
}
