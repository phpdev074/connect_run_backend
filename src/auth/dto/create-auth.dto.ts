import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  ArrayNotEmpty,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ example: 'JohnDoe' })
  @IsString()
  @IsNotEmpty()
  display_name: string;

  @ApiProperty({ example: 'johndoe@yopmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsOptional()
  @IsString()
  password: string;

  @ApiProperty({ example: '+91' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: '1995-01-01' })
  @IsString()
  @IsNotEmpty()
  dob: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @IsNotEmpty()
  height_ft: number;

  @ApiProperty({ example: 11 })
  @IsNumber()
  @IsNotEmpty()
  height_in: number;

  @ApiProperty({ example: "Master's" })
  @IsString()
  @IsOptional()
  education?: string;

  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  @IsOptional()
  occupation?: string;

  @ApiProperty({
    example: "BEGINNER",
  })
  @IsString()
  @IsNotEmpty()
  running_level: string;

  @ApiProperty({
    type: [String],
    example: ['Running', 'Hiking'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  interests: string[];

  @ApiProperty({
    example: 15,
    description: 'Miles per week',
  })
  @IsNumber()
  @Min(0)
  miles_per_week: number;

  @ApiProperty({
    example: '9:18',
    description: 'Average Pace (min/mile)',
    required: false,
  })
  @IsString()
  @IsOptional()
  average_pace?: string;

  @ApiProperty({
    type: [String],
    example: ['Monday', 'Wednesday', 'Friday'],
    description: 'Preferred run days',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferred_days?: string[];

  @ApiProperty({
    type: [String],
    example: ['Dating', 'Buddy / Competitor'],
    description: 'Modes (Dating, Buddy / Competitor, Groups & Community)',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modes?: string[];

  @ApiProperty({
    type: [String],
    example: ['img1.jpg', 'img2.jpg'],
    required: false,
  })
  @IsArray()
  @IsOptional()
  profile_galary?: string[];

  @ApiProperty({ example: 'Mumbai', required: false })
  @IsString()
  @IsOptional()
  gym_location?: string;

  @ApiProperty({ example: 19.0760, required: false })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiProperty({ example: 72.8777, required: false })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiProperty({
    example: 'I am a new user',
    required: false,
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({
    example: 'deviceToken',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceToken?: string;

  @ApiProperty({
    type: [String],
    example: ['matches1', 'matches2'],
    description: 'User match preferences',
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  match_preferences?: string[];
}