# / [] create new poll
@router.post('/', response_model=CreatePollResponse)
async def create(request: Request, data: CreatePoll):
    # / {client} => {}: create new poll
    # / if title contains violation words
    for title in [data.title, *(vote.title for vote in data.votes)]:
        # / validate title
        if check_violation(title):
            # / {client} <x {}: response 400
            raise ViolationWordError
    # / GROUP
    mysql_pool = request.state.mysql_pool
    async with mysql_pool() as session:
        poll_data, votes_data = split_dict(Box(data.dict()), 'votes')
        # / {} > [database]: create poll
        poll = await crud.create_poll(session=session, data=poll_data)
        # / {} < [database]: return new poll
        # / {} > [database]: create votes
        await crud.create_votes(session=session, poll=poll, data=votes_data)
        # / {} < [database]: return new votes
        await session.commit()
    # / {client} <= {}: response 200
    return ResponseBM(data=poll | Box(votes=votes_data))