import {
  Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';


@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @ApiExcludeEndpoint()
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const data = await this.usersService.create(createUserDto);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'User created successfully',
      data,
    };
  }

  @ApiExcludeEndpoint()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.usersService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User fetched successfully',
      data,
    };
  }

  @ApiExcludeEndpoint()
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const data = await this.usersService.update(id, updateUserDto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User updated successfully',
      data,
    };
  }

  @ApiExcludeEndpoint()
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const data = await this.usersService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User deleted successfully',
      data,
    };
  }
}
